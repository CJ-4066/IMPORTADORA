import { Prisma, type RockyAiSettings } from "@prisma/client";
import { prisma } from "../prisma";
import { buildSellableProductWhere } from "../store-shared";
import { searchCatalogIdentity } from "../rocky-product-query";
import { claimChannel, deliver, snapshot, isLocal } from "./adapters";
import { generateDecision } from "./provider";
import { automaticAllowed, channels, currentDraft, decisionSchema, hash, needsHuman, renderDecision, settingsSchema,
  targetKey, type AiChannel, type AiMode, type Policies, type ProductFact } from "./policy";
import { socialRequest, type SocialPage, type SocialConversation } from "../social-inbox";

export const emptyPolicies: Policies = { hours: "", shipping: "", location: "", payment: "", returns: "" };
export const defaultChannels = Object.fromEntries(channels.map(c => [c, "OFF"]));
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function settings() {
  const existing = await prisma.rockyAiSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  // Reuse the information already approved for Rocky; never invent store policies.
  const { rockyInformationReply } = await import("../rocky-engine");
  const policies = { ...emptyPolicies, hours: rockyInformationReply("horarios"),
    shipping: rockyInformationReply("envíos"), location: rockyInformationReply("ubicación"),
    payment: rockyInformationReply("medios de pago") };
  return prisma.rockyAiSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, policies, channelDefaults: defaultChannels } });
}
export async function audit(actor: string, action: string, conversationId?: string, detail?: unknown) {
  return prisma.rockyAiAudit.create({ data: { actor, action, conversationId, ...(detail === undefined ? {} : { detail: json(detail) }) } });
}
export async function saveSettings(input: unknown, actor: string) {
  const data = settingsSchema.parse(input);
  await settings();
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "RockyAiSettings" WHERE id = 1 FOR UPDATE`;
    const [global] = await tx.$queryRaw<{ botMasterSwitch: boolean }[]>`SELECT "botMasterSwitch" FROM "StoreSettings" WHERE id = 1 FOR SHARE`;
    // The legacy master switch remains the single emergency control for every
    // automated channel. Do not allow the new module to silently bypass it.
    if (data.enabled && global && !global.botMasterSwitch) throw new Error("GLOBAL_AUTOMATION_DISABLED");
    const saved = await tx.rockyAiSettings.update({ where: { id: 1 }, data: { ...data, revision: { increment: 1 }, defaultsSince: new Date() } });
    await tx.rockyAiDraft.updateMany({ where: { state: { in: ["DRAFT", "QUEUED"] } }, data: { state: "EXPIRED", reason: "La configuración cambió." } });
    await tx.rockyAiAudit.create({ data: { actor, action: "settings_changed", detail: json(data) } });
    return saved;
  });
}
export async function emergencyStop(actor: string) {
  await settings();
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "RockyAiSettings" WHERE id = 1 FOR UPDATE`;
    await tx.rockyAiSettings.update({ where: { id: 1 }, data: { enabled: false, revision: { increment: 1 } } });
    await tx.rockyAiDraft.updateMany({ where: { state: { in: ["DRAFT", "QUEUED"] } }, data: { state: "EXPIRED", reason: "Parada de emergencia." } });
    await tx.rockyAiAudit.create({ data: { actor, action: "emergency_stop" } });
  });
}
export async function pauseForHuman(channel: AiChannel, externalId: string, actor: string) {
  const id = targetKey(channel, externalId);
  await prisma.$transaction(async tx => {
    const changed = await tx.rockyAiConversation.updateMany({ where: { id }, data: { humanControl: true, revision: { increment: 1 } } });
    if (!changed.count) return;
    await tx.rockyAiDraft.updateMany({ where: { conversationId: id, state: { in: ["DRAFT", "QUEUED"] } }, data: { state: "EXPIRED", reason: "Intervención humana." } });
    await tx.rockyAiAudit.create({ data: { actor, action: "human_takeover", conversationId: id } });
  });
}
export async function configureConversation(channel: AiChannel, externalId: string, mode: AiMode, humanControl: boolean, actor: string) {
  const id = targetKey(channel, externalId);
  // Invalidate before making external calls; a failed takeover leaves AI paused.
  await pauseForHuman(channel, externalId, actor);
  await snapshot(channel, externalId); // validates channel and existence
  const before = await prisma.rockyAiConversation.upsert({ where: { id }, create: { id, channel, externalId, mode: "OFF", humanControl: true },
    update: {} });
  const state = await claimChannel(channel, externalId);
  const changed = await prisma.rockyAiConversation.updateMany({ where: { id, revision: before.revision }, data: {
    mode, humanControl: mode === "OFF" || humanControl, revision: { increment: 1 },
    activatedAt: new Date(), lastTrigger: state.triggerId || null, lastError: null,
  } });
  if (!changed.count) throw new Error("CONTROL_CHANGED");
  const saved = await prisma.rockyAiConversation.findUniqueOrThrow({ where: { id } });
  await audit(actor, "mode_changed", id, { mode, humanControl: saved.humanControl });
  return saved;
}
export async function productsByIds(ids: string[]): Promise<ProductFact[]> {
  const rows = await prisma.product.findMany({ where: { AND: [buildSellableProductWhere(), { id: { in: ids.slice(0, 8) } }] },
    select: { id: true, name: true, code: true, unitPrice: true, stockUnits: true, wholesalePrice: true, wholesaleMinQty: true } });
  return ids.flatMap(id => { const p = rows.find(r => r.id === id); return p ? [{
    id: p.id, name: p.name, code: p.code, price: Number(p.unitPrice), stock: p.stockUnits,
    wholesalePrice: p.wholesalePrice == null ? null : Number(p.wholesalePrice), wholesaleMinQty: p.wholesaleMinQty,
  }] : []; });
}
async function reserve(config: RockyAiSettings, conversationId: string, tokens: number) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "RockyAiSettings" WHERE id = 1 FOR UPDATE`;
    const fresh = await tx.rockyAiSettings.findUniqueOrThrow({ where: { id: 1 } });
    if (!fresh.enabled || fresh.revision !== config.revision) throw new Error("AI_DISABLED");
    // Daily operational quotas use the business timezone, not host timezone.
    const day = new Date(new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10) + "T05:00:00Z");
    const usage = await tx.rockyAiUsage.aggregate({ where: { createdAt: { gte: day } }, _count: true, _sum: { reservedTokens: true } });
    if (usage._count >= fresh.dailyRequests || (usage._sum.reservedTokens ?? 0) + tokens > fresh.dailyTokens) throw new Error("DAILY_LIMIT");
    return (await tx.rockyAiUsage.create({ data: { conversationId, model: config.model, reservedTokens: tokens } })).id;
  });
}
async function withConversationLock<T>(id: string, work: () => Promise<T>): Promise<T | null> {
  return prisma.$transaction(async tx => {
    const [row] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtextextended(${`ai:${id}`}, 43)) AS locked`;
    return row.locked ? work() : null;
  }, { timeout: 150000, maxWait: 5000 });
}
export async function generateDraft(id: string, actor: string, explicit = false) {
  return withConversationLock(id, async () => {
    const config = await settings();
    const c = await prisma.rockyAiConversation.findUniqueOrThrow({ where: { id } });
    if (c.mode === "OFF") throw new Error("MODE_OFF");
    const state = await snapshot(c.channel as AiChannel, c.externalId);
    if (!state.triggerId || !state.owned || !state.canSend) throw new Error(state.reason || "NO_CUSTOMER_MESSAGE");
    if (!explicit && (c.lastTrigger === state.triggerId || c.humanControl && c.mode !== "COPILOT")) return null;
    if (!explicit && state.history.at(-1)?.role !== "user") {
      await pauseForHuman(c.channel as AiChannel, c.externalId, "external_reply");
      return null;
    }
    if (!explicit && Date.now() - Date.parse(state.history.at(-1)!.at) < 10000) return null;
    if (!config.enabled || !process.env.OPENAI_API_KEY) throw new Error("OPENAI_NOT_CONFIGURED_OR_DISABLED");
    const policies = { ...emptyPolicies, ...(config.policies as object) };
    const latest = state.history.filter(m => m.role === "user").at(-1)!;
    let decision: ReturnType<typeof decisionSchema.parse>;
    let products: ProductFact[] = [];
    if (needsHuman(latest.text) || latest.attachment) {
      decision = { intent: "handoff", reason: latest.attachment ? "unsupported" : "human_requested", productIds: [], quantity: 1, policyKey: "none" };
    } else {
      const result = await generateDecision({
        model: config.model, maxOutputTokens: config.maxOutputTokens, history: state.history, policies,
        search: async query => productsByIds((await searchCatalogIdentity(query, 8)).ids),
        reserve: tokens => reserve(config, id, tokens),
        record: async (usageId, input, output) => { await prisma.rockyAiUsage.update({ where: { id: usageId },
          data: { inputTokens: input, outputTokens: output, reservedTokens: input + output, state: "COMPLETED" } }); },
      });
      decision = result.decision; products = result.products;
    }
    const rendered = renderDecision(decision, products, policies);
    const freshState = await snapshot(c.channel as AiChannel, c.externalId);
    if (freshState.contextHash !== state.contextHash) throw new Error("CONTEXT_CHANGED");
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "RockyAiSettings" WHERE id = 1 FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM "RockyAiConversation" WHERE id = ${id} FOR UPDATE`;
      const [fresh, current] = await Promise.all([tx.rockyAiSettings.findUniqueOrThrow({ where: { id: 1 } }), tx.rockyAiConversation.findUniqueOrThrow({ where: { id } })]);
      if (!fresh.enabled || fresh.revision !== config.revision || current.revision !== c.revision) throw new Error("CONTROL_CHANGED");
      await tx.rockyAiDraft.updateMany({ where: { conversationId: id, state: { in: ["DRAFT", "QUEUED"] } }, data: { state: "EXPIRED", reason: "Sugerencia reemplazada." } });
      const auto = !explicit && !c.humanControl && automaticAllowed(c.mode, decision, rendered.safe);
      const draft = await tx.rockyAiDraft.create({ data: { conversationId: id, triggerId: state.triggerId, contextHash: state.contextHash,
        controlRevision: c.revision, settingsRevision: config.revision, state: auto ? "QUEUED" : "DRAFT",
        text: rendered.text, decision: json(decision), evidence: json(products), reason: rendered.reason,
        expiresAt: new Date(Date.now() + 5 * 60000) } });
      await tx.rockyAiConversation.update({ where: { id }, data: { lastTrigger: state.triggerId, lastError: null,
        ...(!rendered.safe && c.mode !== "COPILOT" ? { humanControl: true } : {}) } });
      await tx.rockyAiAudit.create({ data: { actor, action: auto ? "auto_queued" : "draft_created", conversationId: id, detail: { draftId: draft.id, reason: rendered.reason } } });
      return draft;
    });
  });
}

export async function approveDraft(id: string, text: string, actor: string) {
  const draft = await prisma.rockyAiDraft.findUniqueOrThrow({ where: { id }, include: { conversation: true } });
  return withConversationLock(draft.conversationId, async () => {
    if (!text.trim() || text.length > 1000) throw new Error("TEXT_LIMIT");
    const state = await snapshot(draft.conversation.channel as AiChannel, draft.conversation.externalId);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "RockyAiSettings" WHERE id = 1 FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM "RockyAiConversation" WHERE id = ${draft.conversationId} FOR UPDATE`;
      const config = await tx.rockyAiSettings.findUniqueOrThrow({ where: { id: 1 } });
      const c = await tx.rockyAiConversation.findUniqueOrThrow({ where: { id: draft.conversationId } });
      if (!config.enabled || c.mode === "OFF" || !currentDraft(draft, state, c.revision, config.revision)) throw new Error("DRAFT_EXPIRED");
      const changed = await tx.rockyAiDraft.updateMany({ where: { id, state: "DRAFT" }, data: { state: "QUEUED", text: text.trim(), approvedBy: actor, approvedAt: new Date() } });
      if (!changed.count) throw new Error("DRAFT_ALREADY_PROCESSED");
      await tx.rockyAiAudit.create({ data: { actor, action: "draft_approved", conversationId: c.id, detail: { draftId: id, edited: text.trim() !== draft.text } } });
    });
    return true;
  });
}
export async function discardDraft(id: string, actor: string) {
  const d = await prisma.rockyAiDraft.findUniqueOrThrow({ where: { id } });
  await prisma.rockyAiDraft.updateMany({ where: { id, state: { in: ["DRAFT", "QUEUED"] } }, data: { state: "DISCARDED" } });
  await audit(actor, "draft_discarded", d.conversationId, { draftId: id });
}
export async function dispatchDraft(id: string) {
  const initial = await prisma.rockyAiDraft.findUniqueOrThrow({ where: { id } });
  return withConversationLock(initial.conversationId, async () => {
    const d = await prisma.rockyAiDraft.findUniqueOrThrow({ where: { id }, include: { conversation: true } });
    if (d.state !== "QUEUED") return;
    const c = d.conversation, config = await settings();
    const state = await snapshot(c.channel as AiChannel, c.externalId);
    const decision = decisionSchema.parse(d.decision);
    const products = await productsByIds(decision.productIds);
    const policies = { ...emptyPolicies, ...(config.policies as object) };
    const rendered = renderDecision(decision, products, policies);
    const previous = decision.productIds.map(id => (d.evidence as unknown as ProductFact[]).find(p => p.id === id));
    const factsUnchanged = hash(products) === hash(previous);
    const permitted = config.enabled && c.mode !== "OFF" && currentDraft(d, state, c.revision, config.revision) &&
      (Boolean(d.approvedBy) || !c.humanControl && automaticAllowed(c.mode, decision, rendered.safe)) && factsUnchanged;
    if (!permitted) {
      await prisma.rockyAiDraft.updateMany({ where: { id, state: "QUEUED" }, data: { state: "EXPIRED", reason: "Cambió el contexto, el control o el catálogo." } });
      return;
    }
    const claimed = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "RockyAiSettings" WHERE id = 1 FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM "RockyAiConversation" WHERE id = ${c.id} FOR UPDATE`;
      const [fresh, current] = await Promise.all([tx.rockyAiSettings.findUniqueOrThrow({ where: { id: 1 } }), tx.rockyAiConversation.findUniqueOrThrow({ where: { id: c.id } })]);
      if (!fresh.enabled || fresh.revision !== d.settingsRevision || current.revision !== d.controlRevision ||
        (!d.approvedBy && current.humanControl)) return false;
      return (await tx.rockyAiDraft.updateMany({ where: { id, state: "QUEUED", expiresAt: { gt: new Date() } }, data: { state: "SENDING" } })).count === 1;
    });
    if (!claimed) return;
    try {
      const providerMessageId = await deliver(c.channel as AiChannel, c.externalId, d.text, d.id, d.approvedBy);
      await prisma.rockyAiDraft.update({ where: { id }, data: { state: "SUBMITTED", providerMessageId } });
      await audit(d.approvedBy || "rocky-ai", "reply_submitted", c.id, { draftId: id, providerMessageId });
    } catch {
      await prisma.rockyAiDraft.update({ where: { id }, data: { state: "UNCERTAIN", reason: "Entrega sin confirmar. No se reintentará automáticamente." } });
      await pauseForHuman(c.channel as AiChannel, c.externalId, "delivery_uncertain");
    }
  });
}
export async function conversationStatus(channel: AiChannel, externalId: string) {
  const config = await settings(), id = targetKey(channel, externalId);
  const conversation = await prisma.rockyAiConversation.findUnique({ where: { id } });
  const state = await snapshot(channel, externalId);
  if (conversation) await prisma.rockyAiDraft.updateMany({ where: { conversationId: id, state: { in: ["DRAFT", "QUEUED"] },
    OR: [{ expiresAt: { lte: new Date() } }, { contextHash: { not: state.contextHash } }, { controlRevision: { not: conversation.revision } }, { settingsRevision: { not: config.revision } }] },
    data: { state: "EXPIRED", reason: "La sugerencia ya no está vigente." } });
  const drafts = await prisma.rockyAiDraft.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" }, take: 8,
    select: { id: true, state: true, text: true, reason: true, approvedBy: true, expiresAt: true, createdAt: true } });
  return { conversation, drafts, enabled: config.enabled, configured: Boolean(process.env.OPENAI_API_KEY), owned: state.owned,
    canSend: state.canSend, reason: state.reason, workerOnline: Boolean(config.workerSeenAt && Date.now() - config.workerSeenAt.getTime() < 180000) };
}

async function discoverDefaults(config: RockyAiSettings) {
  const defaults = config.channelDefaults as Record<string, AiMode>;
  for (const channel of channels) {
    const mode = defaults[channel];
    if (!mode || mode === "OFF") continue;
    let ids: string[] = [];
    if (isLocal(channel)) {
      ids = (await prisma.conversation.findMany({ where: { channel: channel === "whatsapp" ? "WHATSAPP" : "TELEGRAM", botEnabled: true, assignedUserId: null, status: "AUTOMATICO",
        createdAt: { gte: config.defaultsSince }, lastMessageAt: { gte: new Date(Date.now() - 86400000) } }, select: { id: true } })).map(c => c.id);
    } else {
      let cursor: string | null = null;
      for (let page = 0; page < 20; page++) {
        const result: SocialPage<SocialConversation & { createdAt?: string }> = await socialRequest(`/conversations?channel=${channel}&botCategory=all&perPage=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        ids.push(...result.data.filter(c => c.createdAt && Date.parse(c.createdAt) >= config.defaultsSince.getTime()).map(c => c.id));
        cursor = result.nextCursor; if (!cursor) break;
      }
    }
    for (const externalId of ids) {
      const id = targetKey(channel, externalId);
      if (await prisma.rockyAiConversation.findUnique({ where: { id } })) continue;
      await configureConversation(channel, externalId, mode, mode === "COPILOT", "channel_default");
      // New conversations only: handle the first inbound after taking ownership.
      await prisma.rockyAiConversation.update({ where: { id }, data: { lastTrigger: null } });
    }
  }
}
export async function workerTick() {
  return prisma.$transaction(async lock => {
    const [row] = await lock.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(72602620) AS locked`;
    if (!row.locked) return;
    const config = await settings();
    const global = await lock.storeSettings.findUnique({ where: { id: 1 }, select: { botMasterSwitch: true } });
    if (global && !global.botMasterSwitch) {
      await lock.rockyAiSettings.updateMany({ where: { id: 1, enabled: true }, data: { enabled: false, revision: { increment: 1 } } });
      await lock.rockyAiDraft.updateMany({ where: { state: { in: ["DRAFT", "QUEUED"] } }, data: { state: "EXPIRED", reason: "Automatización global detenida." } });
      return;
    }
    await prisma.rockyAiSettings.update({ where: { id: 1 }, data: { workerSeenAt: new Date(), workerError: null } });
    const abandoned = await prisma.rockyAiDraft.findMany({ where: { state: "SENDING", updatedAt: { lt: new Date(Date.now() - 180000) } } });
    for (const d of abandoned) {
      await prisma.rockyAiDraft.updateMany({ where: { id: d.id, state: "SENDING" }, data: { state: "UNCERTAIN", reason: "Proceso interrumpido; verificar entrega." } });
      const c = await prisma.rockyAiConversation.findUniqueOrThrow({ where: { id: d.conversationId } });
      await pauseForHuman(c.channel as AiChannel, c.externalId, "worker_recovery");
    }
    await prisma.rockyAiDraft.updateMany({ where: { state: { in: ["DRAFT", "QUEUED"] }, expiresAt: { lte: new Date() } }, data: { state: "EXPIRED" } });
    if (!config.enabled) return;
    if (process.env.OPENAI_API_KEY) {
      try { await discoverDefaults(config); } catch { await prisma.rockyAiSettings.update({ where: { id: 1 }, data: { workerError: "Revisa la conexión y permisos de los canales predeterminados." } }); }
    }
    // Work in oldest-updated order; each scan touches processed rows for fairness.
    const conversations = await prisma.rockyAiConversation.findMany({ where: { mode: { not: "OFF" },
      OR: [{ humanControl: false }, { mode: "COPILOT" }] }, orderBy: { updatedAt: "asc" }, take: 10 });
    for (const c of conversations) {
      await prisma.rockyAiSettings.update({ where: { id: 1 }, data: { workerSeenAt: new Date() } });
      try { if (process.env.OPENAI_API_KEY) await generateDraft(c.id, "worker"); }
      catch (error) {
        // A new customer turn during inference is normal: process its fresh context next tick.
        if (!(error instanceof Error && ["CONTEXT_CHANGED", "CONTROL_CHANGED"].includes(error.message))) {
          await prisma.rockyAiConversation.update({ where: { id: c.id }, data: { lastError: "No se generó respuesta. Revisa conexión, límites y control del canal.", humanControl: true } });
        }
      }
      await prisma.rockyAiConversation.update({ where: { id: c.id }, data: { updatedAt: new Date() } });
    }
    for (const draft of await prisma.rockyAiDraft.findMany({ where: { state: "QUEUED" }, orderBy: { createdAt: "asc" }, take: 20 })) {
      try { await dispatchDraft(draft.id); }
      catch { await prisma.rockyAiDraft.updateMany({ where: { id: draft.id, state: "QUEUED" }, data: { state: "EXPIRED", reason: "No se pudo validar el canal antes del envío." } }); }
    }
  }, { timeout: 1200000, maxWait: 5000 });
}
