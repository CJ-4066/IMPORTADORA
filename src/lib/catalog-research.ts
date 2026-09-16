import { z } from "zod";
import { parseYouTubeUrl } from "@/lib/youtube";

const specificationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(255),
});

const variantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  hexColor: z.string().trim().max(16).nullable(),
  sku: z.string().trim().max(64).nullable(),
});

const videoSchema = z.object({
  title: z.string().trim().min(1).max(180),
  url: z.string().url().max(2_000),
});

const documentSchema = z.object({
  title: z.string().trim().min(1).max(180),
  url: z.string().url().max(2_000),
  type: z.enum(["PDF", "WARRANTY", "MANUAL", "GUIDE"]),
});

export const catalogResearchProposalSchema = z.object({
  identified: z.boolean(),
  brand: z.string().trim().max(120).nullable(),
  model: z.string().trim().max(180).nullable(),
  confidence: z.number().min(0).max(1),
  descriptionShort: z.string().trim().max(180),
  descriptionFull: z.string().trim().max(8_000),
  specifications: z.array(specificationSchema).max(40),
  variants: z.array(variantSchema).max(30),
  videos: z.array(videoSchema).max(12),
  documents: z.array(documentSchema).max(12),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
  officialSourceUrls: z.array(z.string().url().max(2_000)).max(20),
});

export type CatalogResearchProposal = z.infer<typeof catalogResearchProposalSchema>;

export type CatalogResearchProduct = {
  code: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  technicalSpecs: string | null;
  imageUrl: string | null;
};

export type CatalogResearchSource = {
  url: string;
  title: string | null;
  domain: string | null;
  sourceType: "WEB" | "CITATION";
  isOfficial: boolean;
};

export type CatalogResearchResult = {
  proposal: CatalogResearchProposal;
  sources: CatalogResearchSource[];
  provider: "openai";
  model: string;
};

type OpenAIResponse = {
  status?: string;
  error?: { code?: string; message?: string } | null;
  output_text?: string;
  output?: Array<Record<string, unknown>>;
};

type ResearchDependencies = {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
};

export class CatalogResearchError extends Error {
  constructor(
    public readonly code: string,
    public readonly publicMessage: string,
    options?: { cause?: unknown },
  ) {
    super(publicMessage, options);
    this.name = "CatalogResearchError";
  }
}

const resultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "identified",
    "brand",
    "model",
    "confidence",
    "descriptionShort",
    "descriptionFull",
    "specifications",
    "variants",
    "videos",
    "documents",
    "warnings",
    "officialSourceUrls",
  ],
  properties: {
    identified: { type: "boolean" },
    brand: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    descriptionShort: { type: "string", maxLength: 180 },
    descriptionFull: { type: "string" },
    specifications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "value"],
        properties: { name: { type: "string" }, value: { type: "string" } },
      },
    },
    variants: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "hexColor", "sku"],
        properties: {
          name: { type: "string" },
          hexColor: { type: ["string", "null"] },
          sku: { type: ["string", "null"] },
        },
      },
    },
    videos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url"],
        properties: { title: { type: "string" }, url: { type: "string" } },
      },
    },
    documents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url", "type"],
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          type: { type: "string", enum: ["PDF", "WARRANTY", "MANUAL", "GUIDE"] },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
    officialSourceUrls: { type: "array", items: { type: "string" } },
  },
} as const;

function buildResearchPrompt(product: CatalogResearchProduct) {
  const knownData = JSON.stringify({
    sku: product.code,
    name: product.name,
    brand: product.brand,
    category: product.category,
    currentDescription: product.description,
    currentTechnicalSpecs: product.technicalSpecs,
    imageUrl: product.imageUrl,
  });

  return `Investiga este producto para una tienda peruana de tecnología e importaciones. Datos actuales: ${knownData}

Reglas obligatorias:
- Identifica la marca y el modelo exactos antes de atribuir especificaciones.
- Prioriza fabricante, manual oficial y distribuidor autorizado. Usa comercios solo como apoyo.
- No mezcles variantes o generaciones parecidas. Si no puedes identificar el modelo, identified=false, deja vacíos los datos no comprobados y explica el problema en warnings.
- descriptionShort debe ser comercial, verificable y tener máximo 180 caracteres.
- descriptionFull debe ser texto plano en español, sin HTML, sin Markdown y sin precio ni stock.
- Cada especificación debe ser objetiva y estar respaldada por las fuentes consultadas.
- Incluye variantes únicamente si corresponden al modelo exacto.
- Incluye videos de YouTube oficiales o claramente correspondientes al modelo.
- Incluye manuales/documentos directos y públicos; no inventes URLs.
- officialSourceUrls solo puede contener URLs realmente consultadas que pertenezcan al fabricante o propietario de la marca.
- Ante contradicciones, conserva el dato más autoritativo y agrega una advertencia.`;
}

function extractOutputText(payload: OpenAIResponse) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content as Array<Record<string, unknown>>) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
}

function normalizeHttpUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function collectProviderSources(payload: OpenAIResponse, officialUrls: Set<string>) {
  const collected = new Map<string, Omit<CatalogResearchSource, "isOfficial">>();

  const addSource = (urlValue: unknown, titleValue: unknown, sourceType: "WEB" | "CITATION") => {
    const url = normalizeHttpUrl(urlValue);
    if (!url) return;
    const title = typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : null;
    collected.set(url, { url, title, domain: new URL(url).hostname, sourceType });
  };

  for (const item of payload.output ?? []) {
    if (item.type === "web_search_call") {
      const action = item.action as Record<string, unknown> | undefined;
      const sources = action?.sources;
      if (Array.isArray(sources)) {
        for (const source of sources) {
          if (!source || typeof source !== "object") continue;
          const record = source as Record<string, unknown>;
          addSource(record.url, record.title, "WEB");
        }
      }
    }

    if (item.type === "message" && Array.isArray(item.content)) {
      for (const content of item.content as Array<Record<string, unknown>>) {
        if (!Array.isArray(content.annotations)) continue;
        for (const annotation of content.annotations) {
          if (!annotation || typeof annotation !== "object") continue;
          const record = annotation as Record<string, unknown>;
          if (record.type === "url_citation") addSource(record.url, record.title, "CITATION");
        }
      }
    }
  }

  return [...collected.values()].map((source) => ({
    ...source,
    isOfficial: officialUrls.has(source.url),
  }));
}

function normalizeProposal(proposal: CatalogResearchProposal): CatalogResearchProposal {
  return {
    ...proposal,
    descriptionShort: proposal.descriptionShort.slice(0, 180),
    videos: proposal.videos.filter((video) => parseYouTubeUrl(video.url) !== null),
    officialSourceUrls: proposal.officialSourceUrls
      .map(normalizeHttpUrl)
      .filter((url): url is string => Boolean(url)),
  };
}

export async function researchCatalogProduct(
  product: CatalogResearchProduct,
  dependencies: ResearchDependencies = {},
): Promise<CatalogResearchResult> {
  const apiKey = dependencies.apiKey ?? process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new CatalogResearchError(
      "RESEARCH_PROVIDER_NOT_CONFIGURED",
      "El agente de investigación todavía no tiene configurada su conexión de IA.",
    );
  }

  const model = dependencies.model ?? (process.env.CATALOG_RESEARCH_MODEL?.trim() || "gpt-5.5");
  const timeoutMs = dependencies.timeoutMs ?? Number(process.env.CATALOG_RESEARCH_TIMEOUT_MS || 120_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await (dependencies.fetchImpl ?? fetch)("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        tools: [{ type: "web_search" }],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        max_tool_calls: 12,
        max_output_tokens: 6_000,
        instructions:
          "Eres un investigador técnico de catálogo. No inventes datos. Devuelve solo información respaldada por búsquedas web y cumple exactamente el esquema solicitado.",
        input: buildResearchPrompt(product),
        text: {
          format: {
            type: "json_schema",
            name: "catalog_product_research",
            strict: true,
            schema: resultJsonSchema,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new CatalogResearchError(
        "RESEARCH_PROVIDER_REJECTED",
        "El proveedor de investigación no pudo completar la consulta.",
      );
    }

    const payload = (await response.json()) as OpenAIResponse;
    const outputText = extractOutputText(payload);
    if (payload.status !== "completed" || !outputText) {
      throw new CatalogResearchError(
        "RESEARCH_RESPONSE_INVALID",
        "La investigación terminó sin una propuesta válida.",
      );
    }

    let rawProposal: unknown;
    try {
      rawProposal = JSON.parse(outputText);
    } catch (error) {
      throw new CatalogResearchError(
        "RESEARCH_RESPONSE_INVALID",
        "La investigación devolvió un formato no válido.",
        { cause: error },
      );
    }

    const proposal = normalizeProposal(catalogResearchProposalSchema.parse(rawProposal));
    const officialUrls = new Set(proposal.officialSourceUrls);
    const sources = collectProviderSources(payload, officialUrls);

    if (sources.length === 0) {
      throw new CatalogResearchError(
        "RESEARCH_SOURCES_MISSING",
        "La propuesta no incluyó fuentes verificables y no puede aplicarse.",
      );
    }

    return { proposal, sources, provider: "openai", model };
  } catch (error) {
    if (error instanceof CatalogResearchError) throw error;
    if (error instanceof z.ZodError) {
      throw new CatalogResearchError(
        "RESEARCH_RESPONSE_INVALID",
        "La investigación devolvió datos que no cumplen el formato esperado.",
        { cause: error },
      );
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new CatalogResearchError(
        "RESEARCH_TIMEOUT",
        "La investigación tardó demasiado. Inténtalo nuevamente.",
        { cause: error },
      );
    }
    throw new CatalogResearchError(
      "RESEARCH_NETWORK_ERROR",
      "No se pudo conectar con el servicio de investigación.",
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function proposalToTechnicalSpecs(proposal: Pick<CatalogResearchProposal, "specifications">) {
  return proposal.specifications.map((spec) => `- **${spec.name}:** ${spec.value}`).join("\n");
}
