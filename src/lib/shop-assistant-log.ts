import "server-only";

import { prisma } from "@/lib/prisma";

type CreateShopAssistantLogInput = {
  sessionId?: string | null;
  userMessage: string;
  baseReply?: string | null;
  finalReply?: string | null;
  intent?: string | null;
  usedOllama?: boolean;
  ollamaModel?: string | null;
  ollamaLatencyMs?: number | null;
  productsCount?: number;
  productIds?: string[];
  error?: string | null;
};

export async function createShopAssistantLog(input: CreateShopAssistantLogInput) {
  try {
    await prisma.shopAssistantLog.create({
      data: {
        sessionId: input.sessionId ?? null,
        userMessage: input.userMessage,
        baseReply: input.baseReply ?? null,
        finalReply: input.finalReply ?? null,
        intent: input.intent ?? null,
        usedOllama: input.usedOllama ?? false,
        ollamaModel: input.ollamaModel ?? null,
        ollamaLatencyMs: input.ollamaLatencyMs ?? null,
        productsCount: input.productsCount ?? 0,
        productIds: input.productIds?.join(",") ?? null,
        error: input.error ?? null,
      },
    });
  } catch (error) {
    console.error("[SHOP_ASSISTANT_LOG_ERROR]", error);
  }
}
