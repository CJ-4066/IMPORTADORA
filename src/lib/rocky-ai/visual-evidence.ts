import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { searchCatalogIdentity } from "../rocky-product-query";
import { buildSellableProductWhere } from "../store-shared";
import { InboundMediaError, loadInboundImage } from "./media";
import type { AiChannel } from "./policy";
import { recordUsage, reserveUsage, settings } from "./service";
import { matchVisualEvidence, visualEvidenceForStorage } from "./visual-match";
import { observeProductImage } from "./vision";

const EVIDENCE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const ANALYSIS_LEASE_MS = 2 * 60 * 1000;
const VISUAL_RESERVATION_INPUT_TOKENS = 5_550;
const VISUAL_RESERVATION_OUTPUT_TOKENS = 450;
const VISUAL_RESERVATION_TOKENS = VISUAL_RESERVATION_INPUT_TOKENS + VISUAL_RESERVATION_OUTPUT_TOKENS;

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function visionEnabled() {
  return process.env.ROCKY_AI_VISION_ENABLED === "true";
}

function stableFailureCode(error: unknown) {
  if (error instanceof InboundMediaError) return error.code;
  if (error instanceof Error && /^(AI_DISABLED|DAILY_LIMIT|INVALID_USAGE|OPENAI_(?:NOT_CONFIGURED|UNAVAILABLE|HTTP_\d+|INCOMPLETE)|VISUAL_OUTPUT_(?:MISSING|INVALID)|IMAGE_(?:MIME_UNSUPPORTED|EMPTY|TOO_LARGE))$/.test(error.message)) return error.message;
  return "VISUAL_ANALYSIS_FAILED";
}

async function recordPending(conversationId: string, triggerId: string) {
  return prisma.rockyAiVisualEvidence.upsert({
    where: { conversationId_triggerId: { conversationId, triggerId } },
    create: { conversationId, triggerId, status: "PENDING", expiresAt: new Date(Date.now() + EVIDENCE_RETENTION_MS) },
    update: { expiresAt: new Date(Date.now() + EVIDENCE_RETENTION_MS) },
  });
}

/** A lease prevents duplicate tabs/processes from paying for the same image. */
async function claimAnalysis(conversationId: string, triggerId: string) {
  await recordPending(conversationId, triggerId);
  const now = new Date();
  const claim = await prisma.rockyAiVisualEvidence.updateMany({
    where: { conversationId, triggerId, OR: [
      { status: "PENDING" },
      { status: "ANALYZING", OR: [{ analysisLeaseUntil: null }, { analysisLeaseUntil: { lt: now } }] },
    ] },
    data: { status: "ANALYZING", failureCode: null, analysisLeaseUntil: new Date(now.getTime() + ANALYSIS_LEASE_MS),
      expiresAt: new Date(now.getTime() + EVIDENCE_RETENTION_MS) },
  });
  return claim.count === 1;
}

async function saveFailure(conversationId: string, triggerId: string, status: "UNSUPPORTED" | "FAILED", failureCode: string) {
  return prisma.rockyAiVisualEvidence.upsert({
    where: { conversationId_triggerId: { conversationId, triggerId } },
    create: { conversationId, triggerId, status, failureCode, expiresAt: new Date(Date.now() + EVIDENCE_RETENTION_MS) },
    update: { status, failureCode, verifiedProductId: null, candidateProductIds: [], evidence: Prisma.DbNull,
      analyzer: null, analysisLeaseUntil: null, expiresAt: new Date(Date.now() + EVIDENCE_RETENTION_MS) },
  });
}

/**
 * An explicit admin-triggered analysis. It never stores raw media or provider
 * URLs, never turns a visual candidate into a product identity, and does not
 * join the automatic reply path until response rules are approved.
 */
export async function analyzeVisualEvidence(input: { conversationId: string; channel: AiChannel; externalId: string; triggerId: string }) {
  const existing = await prisma.rockyAiVisualEvidence.findUnique({ where: { conversationId_triggerId: { conversationId: input.conversationId, triggerId: input.triggerId } } });
  if (existing && !["PENDING", "ANALYZING"].includes(existing.status)) return existing;
  if (!await claimAnalysis(input.conversationId, input.triggerId)) {
    return prisma.rockyAiVisualEvidence.findUniqueOrThrow({ where: { conversationId_triggerId: { conversationId: input.conversationId, triggerId: input.triggerId } } });
  }
  if (input.channel !== "whatsapp" && input.channel !== "telegram") {
    return saveFailure(input.conversationId, input.triggerId, "UNSUPPORTED", "SOCIAL_DOWNLOADER_REQUIRED");
  }
  const message = await prisma.chatMessage.findFirst({
    where: { id: input.triggerId, conversationId: input.externalId, direction: "INBOUND", senderType: "CUSTOMER" },
    select: { messageType: true, mediaUrl: true, metadata: true },
  });
  if (!message) return saveFailure(input.conversationId, input.triggerId, "UNSUPPORTED", "INBOUND_IMAGE_NOT_FOUND");
  try {
    const image = await loadInboundImage({ channel: input.channel, messageType: message.messageType, mediaUrl: message.mediaUrl, metadata: message.metadata });
    const catalog = await prisma.product.findMany({
      where: { AND: [buildSellableProductWhere(), { stockUnits: { gt: 0 }, unitPrice: { gt: 0 }, sourceImageContentHash: { not: null } }] },
      select: { id: true, code: true, sourceImageContentHash: true },
    });
    const exact = await matchVisualEvidence({
      contentHash: image.contentHash,
      catalog,
      observe: async () => {
        if (!visionEnabled()) throw new Error("VISION_NOT_ENABLED");
        const config = await settings();
        if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_NOT_CONFIGURED");
        const usageId = await reserveUsage(config, input.conversationId, VISUAL_RESERVATION_TOKENS);
        const observed = await observeProductImage({ image, model: config.model });
        const usage = observed.usage ?? { inputTokens: VISUAL_RESERVATION_INPUT_TOKENS, outputTokens: VISUAL_RESERVATION_OUTPUT_TOKENS };
        await recordUsage(usageId, usage.inputTokens, usage.outputTokens);
        return observed.observation;
      },
      search: async query => (await searchCatalogIdentity(query, 3)).ids,
    });
    return prisma.rockyAiVisualEvidence.upsert({
      where: { conversationId_triggerId: { conversationId: input.conversationId, triggerId: input.triggerId } },
      create: { conversationId: input.conversationId, triggerId: input.triggerId, sourceHash: image.contentHash, mimeType: image.mimeType,
        byteLength: image.byteLength, status: exact.status, verifiedProductId: exact.verifiedProductId,
        candidateProductIds: json(exact.candidateProductIds), evidence: json(visualEvidenceForStorage(exact)), analyzer: exact.analyzer,
        expiresAt: new Date(Date.now() + EVIDENCE_RETENTION_MS) },
      update: { sourceHash: image.contentHash, mimeType: image.mimeType, byteLength: image.byteLength, status: exact.status,
        verifiedProductId: exact.verifiedProductId, candidateProductIds: json(exact.candidateProductIds), evidence: json(visualEvidenceForStorage(exact)),
        analyzer: exact.analyzer, failureCode: null, analysisLeaseUntil: null, expiresAt: new Date(Date.now() + EVIDENCE_RETENTION_MS) },
    });
  } catch (error) {
    // The flag intentionally leaves the item pending: enabling vision later can
    // analyze the same message once, while no provider/media URL is retained.
    if (error instanceof Error && error.message === "VISION_NOT_ENABLED") {
      return prisma.rockyAiVisualEvidence.update({ where: { conversationId_triggerId: { conversationId: input.conversationId, triggerId: input.triggerId } },
        data: { status: "PENDING", failureCode: "VISION_NOT_ENABLED", analysisLeaseUntil: null, expiresAt: new Date(Date.now() + EVIDENCE_RETENTION_MS) } });
    }
    const code = stableFailureCode(error);
    const unsupported = code === "UNSUPPORTED_MEDIA" || code === "UNSUPPORTED_CHANNEL" || code === "MEDIA_TOO_LARGE" || code === "INVALID_IMAGE";
    return saveFailure(input.conversationId, input.triggerId, unsupported ? "UNSUPPORTED" : "FAILED", code);
  }
}
