import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import {
  CatalogResearchError,
  researchCatalogProduct,
} from "@/lib/catalog-research";
import { prisma } from "@/lib/prisma";

export const maxDuration = 180;

function statusForError(code: string) {
  if (code === "RESEARCH_TIMEOUT") return 504;
  if (code === "RESEARCH_PROVIDER_NOT_CONFIGURED") return 503;
  return 502;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  const { id: productId } = await context.params;
  const requestId = randomUUID();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      code: true,
      name: true,
      brand: true,
      category: true,
      description: true,
      technicalSpecs: true,
      imageUrl: true,
    },
  });

  if (!product) {
    return NextResponse.json(
      { ok: false, code: "PRODUCT_NOT_FOUND", message: "No se encontró el producto.", requestId },
      { status: 404 },
    );
  }

  const run = await prisma.productResearchRun.create({
    data: {
      productId,
      requestId,
      requestedByName: session.name,
      requestedByEmail: session.email,
    },
    select: { id: true },
  });

  console.info("[catalog-research]", { requestId, stage: "started", productId });

  try {
    const result = await researchCatalogProduct(product);
    const saved = await prisma.productResearchRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        provider: result.provider,
        model: result.model,
        confidence: result.proposal.confidence,
        identifiedBrand: result.proposal.brand,
        identifiedModel: result.proposal.model,
        result: result.proposal as Prisma.InputJsonValue,
        completedAt: new Date(),
        sources: {
          create: result.sources.map((source) => ({
            url: source.url,
            title: source.title,
            domain: source.domain,
            sourceType: source.sourceType,
            isOfficial: source.isOfficial,
          })),
        },
      },
      select: {
        id: true,
        requestId: true,
        status: true,
        confidence: true,
        identifiedBrand: true,
        identifiedModel: true,
        result: true,
        createdAt: true,
        sources: {
          select: { url: true, title: true, domain: true, sourceType: true, isOfficial: true },
        },
      },
    });

    console.info("[catalog-research]", {
      requestId,
      stage: "completed",
      productId,
      sourceCount: saved.sources.length,
      confidence: saved.confidence,
    });

    return NextResponse.json({ ok: true, run: saved });
  } catch (error) {
    const safeError =
      error instanceof CatalogResearchError
        ? error
        : new CatalogResearchError(
            "RESEARCH_INTERNAL_ERROR",
            "No se pudo completar la investigación del producto.",
            { cause: error },
          );

    await prisma.productResearchRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorCode: safeError.code,
        errorMessage: safeError.publicMessage,
        completedAt: new Date(),
      },
    });

    console.error("[catalog-research]", {
      requestId,
      stage: "failed",
      productId,
      code: safeError.code,
    });

    return NextResponse.json(
      { ok: false, code: safeError.code, message: safeError.publicMessage, requestId },
      { status: statusForError(safeError.code) },
    );
  }
}
