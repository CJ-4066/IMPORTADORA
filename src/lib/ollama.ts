import "server-only";

import type { ShopAssistantProductCard, ShopAssistantReply } from "@/lib/shop-assistant-types";

type OllamaConfig = {
  enabled: boolean;
  host: string;
  model: string;
  timeoutMs: number;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

const DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b";
const DEFAULT_OLLAMA_TIMEOUT_MS = 8000;

function normalizeHost(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function parseTimeout(value: string | undefined) {
  const timeout = Number(value ?? DEFAULT_OLLAMA_TIMEOUT_MS);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_OLLAMA_TIMEOUT_MS;
}

export function getOllamaConfig(): OllamaConfig {
  const host = normalizeHost(process.env.OLLAMA_HOST ?? DEFAULT_OLLAMA_HOST);
  const model = process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL;
  const timeoutMs = parseTimeout(process.env.OLLAMA_TIMEOUT_MS);
  const enabled = process.env.OLLAMA_ENABLED === "true" && Boolean(host && model);

  return {
    enabled,
    host,
    model,
    timeoutMs,
  };
}

function summarizeProducts(products: ShopAssistantProductCard[] | undefined) {
  return (products ?? []).slice(0, 4).map((product) => ({
    code: product.code,
    name: product.name,
    brand: product.brand,
    category: product.category,
    technicalSpecs: product.technicalSpecs ?? null,
    unitPrice: product.unitPrice,
    wholesalePrice: product.wholesalePrice,
    stockUnits: product.stockUnits,
    availabilityLabel: product.availabilityLabel,
  }));
}

function buildRewritePrompt(input: {
  customerMessage: string;
  baseText: string;
  reply: ShopAssistantReply;
}) {
  const payload = {
    customerMessage: input.customerMessage,
    baseText: input.baseText,
    products: summarizeProducts(input.reply.products),
    quickActions: (input.reply.quickActions ?? []).map((action) => action.label),
    suggestedPrompts: input.reply.suggestedPrompts ?? [],
  };

  return [
    "Eres el redactor de un asistente de ventas para una tienda de importaciones.",
    "Devuelve solo JSON válido con esta forma exacta: {\"text\":\"...\"}.",
    "Reglas estrictas:",
    "- No inventes productos, precios, stock, categorías ni especificaciones.",
    "- No cambies los productos ni las acciones rápidas.",
    "- No agregues promesas, links ni datos que no estén en el JSON de entrada.",
    "- Usa español natural de Perú, claro y breve.",
    "- Si falta información, sugiere revisar el catálogo o WhatsApp, sin alargar.",
    "",
    "JSON de entrada:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function extractJsonText(raw: string) {
  const trimmed = raw.trim();

  try {
    const parsed = JSON.parse(trimmed) as Partial<{ text: string }>;
    return typeof parsed.text === "string" ? parsed.text.trim() : null;
  } catch {
    return null;
  }
}

export async function rewriteAssistantTextWithOllama(input: {
  customerMessage: string;
  reply: ShopAssistantReply;
}): Promise<ShopAssistantReply> {
  const config = getOllamaConfig();

  if (!config.enabled) {
    return input.reply;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.host}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        format: "json",
        messages: [
          {
            role: "system",
            content:
              "Eres un redactor estricto. Responde solo con JSON válido y sin inventar datos.",
          },
          {
            role: "user",
            content: buildRewritePrompt({
              customerMessage: input.customerMessage,
              baseText: input.reply.text,
              reply: input.reply,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return input.reply;
    }

    const data = (await response.json()) as OllamaChatResponse;
    const content = data.message?.content ?? "";
    const text = extractJsonText(content);

    if (!text) {
      return input.reply;
    }

    return {
      ...input.reply,
      text,
    };
  } catch {
    return input.reply;
  } finally {
    clearTimeout(timeout);
  }
}
