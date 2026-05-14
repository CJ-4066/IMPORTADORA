import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPublicWhatsappHref, formatCurrency } from "@/lib/utils";
import type {
  ShopAssistantProductCard,
  ShopAssistantQuickAction,
  ShopAssistantReply,
} from "@/lib/shop-assistant-types";

const MAX_PRODUCTS = 4;
const MAX_SEARCH_CANDIDATES = 80;
const STOPWORDS = new Set([
  "a",
  "al",
  "algo",
  "alguna",
  "alguno",
  "algun",
  "barato",
  "baratos",
  "busca",
  "busco",
  "como",
  "con",
  "cual",
  "cuanto",
  "cuesta",
  "de",
  "del",
  "el",
  "en",
  "es",
  "esta",
  "este",
  "hay",
  "la",
  "las",
  "los",
  "me",
  "mejor",
  "mi",
  "muestrame",
  "muéstrame",
  "necesito",
  "para",
  "por",
  "presupuesto",
  "precio",
  "producto",
  "productos",
  "quiero",
  "unidad",
  "unidades",
  "sol",
  "soles",
  "tendra",
  "tendran",
  "tendrás",
  "tiene",
  "tienen",
  "tienes",
  "tu",
  "un",
  "una",
  "unas",
  "unos",
  "ver",
]);

const SEARCH_SYNONYMS: Record<string, string[]> = {
  audifono: ["audifono", "audifonos", "auricular", "auriculares", "bluetooth"],
  audifonos: ["audifono", "audifonos", "auricular", "auriculares", "bluetooth"],
  auricular: ["auricular", "auriculares", "audifono", "audifonos", "bluetooth"],
  auriculares: ["auricular", "auriculares", "audifono", "audifonos", "bluetooth"],
};

const GIFT_SEARCH_SEEDS = [
  "audifonos",
  "auriculares",
  "parlante",
  "smart watch",
  "accesorios para celular",
  "hogar",
  "cocina",
  "cuidado personal",
  "tecnologia",
  "organizador",
  "iluminacion",
];

export type AssistantProductRecord = {
  id: string;
  slug: string;
  code: string;
  externalCode?: string | null;
  externalId?: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  categoryId?: string | null;
  unitPrice: Prisma.Decimal | number;
  wholesalePrice: Prisma.Decimal | number | null;
  wholesaleMinQty: number;
  boxPrice: Prisma.Decimal | number | null;
  unitsPerBox: number | null;
  stockUnits: number;
  isVisible?: boolean;
  recommendedQuantity?: number;
  recommendationReason?: string;
};

export type AssistantCategoryRecord = {
  id: string;
  name: string;
  slug: string;
};

export type AssistantSettingsRecord = {
  businessName: string;
  currencySymbol: string;
  supportHours: string;
  whatsappNumber: string;
};

export type ShopAssistantRepository = {
  getBaseData: () => Promise<{
    settings: AssistantSettingsRecord;
    categories: AssistantCategoryRecord[];
  }>;
  findProductByCode: (code: string) => Promise<AssistantProductRecord | null>;
  searchVisibleProducts: (query: string) => Promise<AssistantProductRecord[]>;
  getFeaturedProducts: () => Promise<AssistantProductRecord[]>;
  getCategoryProducts: (categoryId: string) => Promise<AssistantProductRecord[]>;
  getRelatedProducts: (product: AssistantProductRecord) => Promise<AssistantProductRecord[]>;
};

export function normalizeAssistantText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAvailabilityLabel(stockUnits: number) {
  if (stockUnits <= 0) {
    return "Sin stock";
  }

  if (stockUnits <= 12) {
    return "Stock bajo";
  }

  return "Disponible";
}

function mapAssistantProduct(
  product: AssistantProductRecord,
  currencySymbol: string,
): ShopAssistantProductCard {
  const unitPrice = Number(product.unitPrice);
  const wholesalePrice = product.wholesalePrice !== null ? Number(product.wholesalePrice) : null;

  return {
    id: product.id,
    slug: product.slug,
    code: product.code,
    name: product.name,
    brand: product.brand,
    category: product.category,
    unitPrice: formatCurrency(unitPrice, currencySymbol),
    unitPriceValue: unitPrice,
    wholesalePrice: wholesalePrice ? formatCurrency(wholesalePrice, currencySymbol) : null,
    wholesalePriceValue: wholesalePrice,
    wholesaleMinQty: product.wholesaleMinQty,
    recommendedQuantity: product.recommendedQuantity,
    recommendationReason: product.recommendationReason,
    unitsPerBox: product.unitsPerBox,
    availabilityLabel: getAvailabilityLabel(product.stockUnits),
    stockUnits: product.stockUnits,
  };
}

function extractProductCode(message: string) {
  const normalized = message
    .toUpperCase()
    .replace(/\bCODIGO\b/g, " ")
    .replace(/\bCÓDIGO\b/g, " ")
    .trim();

  const compoundMatch = normalized.match(/\b([A-Z]{2,})\s*-?\s*(\d{2,})\b/);
  if (compoundMatch && !STOPWORDS.has(compoundMatch[1].toLowerCase())) {
    return `${compoundMatch[1]}-${compoundMatch[2]}`;
  }

  const numericMatch = normalized.match(/\b(\d{2,})\s*-\s*(\d{2,})\b/);
  if (numericMatch) {
    return `${numericMatch[1]}-${numericMatch[2]}`;
  }

  const compactMatches = normalized.match(/\b[A-Z0-9-]{4,}\b/g) ?? [];

  for (const match of compactMatches) {
    const candidate = match.replace(/\s+/g, "");

    if (/\d/.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildCodeCandidates(code: string) {
  const normalized = code.trim().toUpperCase();
  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  const withHyphen = compact.replace(/^([A-Z]{1,6})(\d{2,})$/, "$1-$2");

  return Array.from(new Set([normalized, compact, withHyphen].filter(Boolean)));
}

function extractSearchTerms(message: string) {
  const normalized = normalizeAssistantText(removeBudgetText(message));
  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));

  const expandedTokens = tokens.flatMap((token) => SEARCH_SYNONYMS[token] ?? [token]);

  return Array.from(new Set(expandedTokens)).join(" ").trim();
}

function removeBudgetText(message: string) {
  return message
    .replace(/\b(?:s\/|s\.\/|pen)\s*\d+(?:[.,]\d{1,2})?\b/gi, " ")
    .replace(/\b\d+(?:[.,]\d{1,2})?\s*(?:soles?|s\/|s\.\/|pen)\b/gi, " ")
    .replace(
      /\b(?:presupuesto|hasta|maximo|máximo|maxima|máxima|aprox|aproximado|alrededor|cerca de)\s*(?:de|es|unos|unas)?\s*(?:s\/|s\.\/|pen)?\s*\d+(?:[.,]\d{1,2})?\b/gi,
      " ",
    );
}

function extractBudget(message: string) {
  const candidates = [
    ...message.matchAll(/\b(?:s\/|s\.\/|pen)\s*(\d+(?:[.,]\d{1,2})?)\b/gi),
    ...message.matchAll(/\b(\d+(?:[.,]\d{1,2})?)\s*(?:soles?|s\/|s\.\/|pen)\b/gi),
    ...message.matchAll(
      /\b(?:presupuesto|hasta|maximo|máximo|maxima|máxima|aprox|aproximado|alrededor|cerca de)\s*(?:de|es|unos|unas)?\s*(?:s\/|s\.\/|pen)?\s*(\d+(?:[.,]\d{1,2})?)\b/gi,
    ),
  ];
  const values = candidates
    .map((match) => Number(match[1].replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0);

  return values[0] ?? null;
}

function extractQuantity(message: string) {
  const normalized = normalizeAssistantText(message);
  const matches = [
    ...normalized.matchAll(/\b(\d{1,4})\s*(?:unidades|unidad|unds|und|piezas|pieza)\b/g),
    ...normalized.matchAll(/\bquiero\s*(\d{1,4})\b/g),
    ...normalized.matchAll(/\bpara\s*(\d{1,4})\b/g),
  ];
  const values = matches
    .map((match) => Number(match[1]))
    .filter((value) => Number.isInteger(value) && value > 0);

  return values[0] ?? null;
}

function scoreAssistantProduct(product: AssistantProductRecord, query: string) {
  const normalizedQuery = normalizeAssistantText(query);
  const normalizedCode = normalizeAssistantText(product.code);
  const normalizedName = normalizeAssistantText(product.name);
  const normalizedBrand = normalizeAssistantText(product.brand ?? "");
  const normalizedCategory = normalizeAssistantText(product.category ?? "");
  let score = 0;

  if (normalizedCode === normalizedQuery) score += 120;
  if (normalizedCode.startsWith(normalizedQuery)) score += 90;
  if (normalizedName.startsWith(normalizedQuery)) score += 72;
  if (normalizedName.includes(normalizedQuery)) score += 48;
  if (normalizedBrand.includes(normalizedQuery)) score += 24;
  if (normalizedCategory.includes(normalizedQuery)) score += 20;
  if (product.stockUnits > 0) score += 8;
  if (product.wholesalePrice !== null) score += 5;

  return score;
}

function getProductUnitPrice(product: AssistantProductRecord) {
  return Number(product.unitPrice);
}

function sortProductsForBudget(
  products: AssistantProductRecord[],
  query: string,
  budget: number,
) {
  return products.slice().sort((left, right) => {
    const leftPrice = getProductUnitPrice(left);
    const rightPrice = getProductUnitPrice(right);
    const leftDistance = Math.abs(leftPrice - budget);
    const rightDistance = Math.abs(rightPrice - budget);

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    const leftOverBudget = leftPrice > budget ? 1 : 0;
    const rightOverBudget = rightPrice > budget ? 1 : 0;

    if (leftOverBudget !== rightOverBudget) {
      return leftOverBudget - rightOverBudget;
    }

    return scoreAssistantProduct(right, query) - scoreAssistantProduct(left, query);
  });
}

function isAdultAssistantProduct(product: AssistantProductRecord) {
  const text = normalizeAssistantText(
    `${product.name} ${product.category ?? ""} ${product.brand ?? ""}`,
  );

  return (
    text.includes("juguetes sexuales") ||
    text.includes("consolador") ||
    text.includes("pretty love") ||
    text.includes("vibrator") ||
    text.includes("we love")
  );
}

function isAdultIntent(value: string) {
  const text = normalizeAssistantText(value);

  return (
    text.includes("juguetes sexuales") ||
    text.includes("consolador") ||
    text.includes("vibrador") ||
    text.includes("sex toy") ||
    text.includes("sextoys")
  );
}

function filterSensitiveProducts(
  products: AssistantProductRecord[],
  allowSensitive: boolean,
) {
  return allowSensitive ? products : products.filter((product) => !isAdultAssistantProduct(product));
}

function withRecommendation(
  product: AssistantProductRecord,
  recommendationReason: string,
  recommendedQuantity?: number | null,
): AssistantProductRecord {
  return {
    ...product,
    recommendedQuantity: recommendedQuantity ?? undefined,
    recommendationReason,
  };
}

function getEffectivePrice(product: AssistantProductRecord, quantity: number | null) {
  const unitPrice = getProductUnitPrice(product);
  const wholesalePrice =
    product.wholesalePrice !== null ? Number(product.wholesalePrice) : null;

  if (quantity && wholesalePrice && quantity >= product.wholesaleMinQty) {
    return wholesalePrice;
  }

  return unitPrice;
}

function getSalesReason(
  product: AssistantProductRecord,
  input: {
    budget: number | null;
    quantity: number | null;
  },
  currencySymbol: string,
) {
  const stockLabel =
    product.stockUnits >= 30
      ? "buen stock"
      : product.stockUnits <= 12
        ? "stock bajo, conviene confirmar"
        : "stock disponible";
  const effectivePrice = getEffectivePrice(product, input.quantity);
  const priceLabel = formatCurrency(effectivePrice, currencySymbol);

  if (
    input.quantity &&
    product.wholesalePrice !== null &&
    input.quantity >= product.wholesaleMinQty
  ) {
    return `Conviene para ${input.quantity} unidades: activa mayorista a ${priceLabel} y tiene ${stockLabel}.`;
  }

  if (input.budget) {
    return `Es la opción más cercana a ${formatCurrency(input.budget, currencySymbol)} y tiene ${stockLabel}.`;
  }

  if (product.wholesalePrice !== null) {
    return `Buena opción por precio mayorista desde ${product.wholesaleMinQty} unidades y ${stockLabel}.`;
  }

  return `Buena opción por ${stockLabel}.`;
}

function applySalesRecommendations(
  products: AssistantProductRecord[],
  input: {
    budget: number | null;
    quantity: number | null;
  },
  currencySymbol: string,
) {
  return products.map((product, index) =>
    withRecommendation(
      product,
      index === 0
        ? getSalesReason(product, input, currencySymbol)
        : product.wholesalePrice !== null
          ? `También conviene por mayorista desde ${product.wholesaleMinQty}.`
          : "También puedes considerarlo como alternativa.",
      input.quantity,
    ),
  );
}

function sortProductsForQuantity(products: AssistantProductRecord[], quantity: number) {
  return products.slice().sort((left, right) => {
    const leftWholesaleApplies =
      left.wholesalePrice !== null && quantity >= left.wholesaleMinQty ? 1 : 0;
    const rightWholesaleApplies =
      right.wholesalePrice !== null && quantity >= right.wholesaleMinQty ? 1 : 0;

    if (leftWholesaleApplies !== rightWholesaleApplies) {
      return rightWholesaleApplies - leftWholesaleApplies;
    }

    return getEffectivePrice(left, quantity) - getEffectivePrice(right, quantity);
  });
}

function buildQuickActions(actions: ShopAssistantQuickAction[]) {
  return actions.slice(0, 6);
}

function buildDefaultPrompts() {
  return [
    "Algo para regalar por cumpleaños",
    "Muéstrame ofertas",
    "Busco algo por menos de S/ 50",
    "¿Qué categorías tienes?",
  ];
}

function isGiftIntent(value: string) {
  const text = normalizeAssistantText(value);

  return (
    text.includes("regal") ||
    text.includes("cumple") ||
    text.includes("anivers") ||
    text.includes("detalle") ||
    text.includes("sorpresa") ||
    text.includes("navidad") ||
    text.includes("amigo secreto") ||
    text.includes("mama") ||
    text.includes("papa") ||
    text.includes("madre") ||
    text.includes("padre")
  );
}

function detectGiftOccasion(value: string) {
  const text = normalizeAssistantText(value);

  if (text.includes("cumple")) return "cumpleaños";
  if (text.includes("anivers")) return "aniversario";
  if (text.includes("navidad")) return "navidad";
  if (text.includes("amigo secreto")) return "amigo secreto";
  if (text.includes("madre")) return "día de la madre";
  if (text.includes("padre")) return "día del padre";
  if (text.includes("mama")) return "mamá";
  if (text.includes("papa")) return "papá";

  return null;
}

async function gatherProductsFromQueries(
  repository: ShopAssistantRepository,
  queries: string[],
  allowSensitiveProducts: boolean,
) {
  const seen = new Map<string, AssistantProductRecord>();

  for (const query of queries) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      continue;
    }

    const products = await repository.searchVisibleProducts(trimmedQuery);
    for (const product of products) {
      if (!seen.has(product.id)) {
        seen.set(product.id, product);
      }
    }
  }

  return filterSensitiveProducts(Array.from(seen.values()), allowSensitiveProducts);
}

async function getFallbackRecommendationProducts(
  repository: ShopAssistantRepository,
  allowSensitiveProducts: boolean,
) {
  const products = await gatherProductsFromQueries(
    repository,
    GIFT_SEARCH_SEEDS,
    allowSensitiveProducts,
  );

  if (products.length) {
    return products.slice(0, MAX_PRODUCTS);
  }

  const featured = await repository.getFeaturedProducts();
  return filterSensitiveProducts(featured, allowSensitiveProducts).slice(0, MAX_PRODUCTS);
}

function buildGiftSearchQueries(message: string, recentConversation: string) {
  const normalized = normalizeAssistantText(`${message} ${recentConversation}`);
  const queries = new Set<string>();
  const directSearch = extractSearchTerms(message);

  if (directSearch) {
    queries.add(directSearch);
  }

  for (const seed of GIFT_SEARCH_SEEDS) {
    queries.add(seed);
  }

  if (normalized.includes("para mujer") || normalized.includes("para ella")) {
    queries.add("cuidado personal");
    queries.add("accesorios para celular");
  }

  if (normalized.includes("para hombre") || normalized.includes("para el")) {
    queries.add("audifonos");
    queries.add("parlante");
  }

  if (normalized.includes("tecnolog") || normalized.includes("gadget")) {
    queries.add("smart watch");
    queries.add("audifonos");
    queries.add("parlante");
  }

  if (normalized.includes("hogar") || normalized.includes("casa")) {
    queries.add("hogar");
    queries.add("cocina");
  }

  return Array.from(queries);
}

function formatProductAnswer(product: AssistantProductRecord, currencySymbol: string) {
  const unitPrice = Number(product.unitPrice);
  const wholesalePrice = product.wholesalePrice !== null ? Number(product.wholesalePrice) : null;
  const description =
    product.description &&
    normalizeAssistantText(product.description) !== normalizeAssistantText(product.name)
      ? `Descripción: ${product.description}. `
      : "";
  const pricingLines = [
    `Precio unitario: ${formatCurrency(unitPrice, currencySymbol)}`,
    wholesalePrice
      ? `Mayorista desde ${product.wholesaleMinQty}: ${formatCurrency(wholesalePrice, currencySymbol)}`
      : "Mayorista: mantiene el precio unitario",
  ];

  return `${product.name} (${product.code}). ${description}${pricingLines.join(". ")}. Stock sincronizado: ${product.stockUnits} unidades (${getAvailabilityLabel(product.stockUnits)}).`;
}

function createRealRepository(): ShopAssistantRepository {
  return {
    async getBaseData() {
      const [settings, categories] = await prisma.$transaction([
        prisma.storeSettings.findUnique({ where: { id: 1 } }),
        prisma.category.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true },
        }),
      ]);

      return {
        settings: {
          businessName: settings?.businessName ?? "Importaciones Super",
          currencySymbol: settings?.currencySymbol ?? "S/",
          supportHours: settings?.supportHours ?? "Lun a sáb 8:00 am - 7:00 pm",
          whatsappNumber: settings?.whatsappNumber ?? "51999999999",
        },
        categories,
      };
    },

    async findProductByCode(code) {
      const candidates = buildCodeCandidates(code);

      return prisma.product.findFirst({
        where: {
          OR: [
            ...candidates.map((candidate) => ({
              code: {
                equals: candidate,
                mode: "insensitive" as const,
              },
            })),
            ...candidates.map((candidate) => ({
              externalCode: {
                equals: candidate,
                mode: "insensitive" as const,
              },
            })),
            ...candidates.map((candidate) => ({
              externalId: {
                equals: candidate,
                mode: "insensitive" as const,
              },
            })),
          ],
        },
        select: {
          id: true,
          slug: true,
          code: true,
          externalCode: true,
          externalId: true,
          name: true,
          description: true,
          brand: true,
          category: true,
          categoryId: true,
          unitPrice: true,
          wholesalePrice: true,
          wholesaleMinQty: true,
          boxPrice: true,
          unitsPerBox: true,
          stockUnits: true,
          isVisible: true,
        },
      });
    },

    async searchVisibleProducts(query) {
      if (!query.trim()) {
        return [] satisfies AssistantProductRecord[];
      }

      const searchTokens = query
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
        .slice(0, 4);

      const filters = searchTokens.flatMap((token) => [
        { code: { contains: token, mode: "insensitive" as const } },
        { name: { contains: token, mode: "insensitive" as const } },
        { description: { contains: token, mode: "insensitive" as const } },
        { brand: { contains: token, mode: "insensitive" as const } },
        { category: { contains: token, mode: "insensitive" as const } },
      ]);

      const products = await prisma.product.findMany({
        where: {
          isVisible: true,
          stockUnits: { gt: 0 },
          OR: filters.length
            ? filters
            : [
                { code: { contains: query, mode: "insensitive" } },
                { name: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
                { brand: { contains: query, mode: "insensitive" } },
                { category: { contains: query, mode: "insensitive" } },
              ],
        },
        orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
        take: MAX_SEARCH_CANDIDATES,
        select: {
          id: true,
          slug: true,
          code: true,
          externalCode: true,
          externalId: true,
          name: true,
          description: true,
          brand: true,
          category: true,
          categoryId: true,
          unitPrice: true,
          wholesalePrice: true,
          wholesaleMinQty: true,
          boxPrice: true,
          unitsPerBox: true,
          stockUnits: true,
          isVisible: true,
        },
      });

      return products.sort(
        (left, right) => scoreAssistantProduct(right, query) - scoreAssistantProduct(left, query),
      );
    },

    async getFeaturedProducts() {
      return prisma.product.findMany({
        where: {
          isVisible: true,
          stockUnits: { gt: 0 },
          isFeatured: true,
        },
        orderBy: [{ updatedAt: "desc" }],
        take: MAX_PRODUCTS,
        select: {
          id: true,
          slug: true,
          code: true,
          externalCode: true,
          externalId: true,
          name: true,
          description: true,
          brand: true,
          category: true,
          categoryId: true,
          unitPrice: true,
          wholesalePrice: true,
          wholesaleMinQty: true,
          boxPrice: true,
          unitsPerBox: true,
          stockUnits: true,
          isVisible: true,
        },
      });
    },

    async getCategoryProducts(categoryId) {
      return prisma.product.findMany({
        where: {
          isVisible: true,
          stockUnits: { gt: 0 },
          categoryId,
        },
        orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
        take: MAX_PRODUCTS,
        select: {
          id: true,
          slug: true,
          code: true,
          externalCode: true,
          externalId: true,
          name: true,
          description: true,
          brand: true,
          category: true,
          categoryId: true,
          unitPrice: true,
          wholesalePrice: true,
          wholesaleMinQty: true,
          boxPrice: true,
          unitsPerBox: true,
          stockUnits: true,
          isVisible: true,
        },
      });
    },

    async getRelatedProducts(product) {
      return prisma.product.findMany({
        where: {
          id: { not: product.id },
          isVisible: true,
          stockUnits: { gt: 0 },
          ...(product.categoryId
            ? { categoryId: product.categoryId }
            : product.category
              ? { category: product.category }
              : {}),
        },
        orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
        take: MAX_PRODUCTS,
        select: {
          id: true,
          slug: true,
          code: true,
          externalCode: true,
          externalId: true,
          name: true,
          description: true,
          brand: true,
          category: true,
          categoryId: true,
          unitPrice: true,
          wholesalePrice: true,
          wholesaleMinQty: true,
          boxPrice: true,
          unitsPerBox: true,
          stockUnits: true,
          isVisible: true,
        },
      });
    },
  };
}

export function createShopAssistantService(repository: ShopAssistantRepository) {
  return async function answer(input: {
    message: string;
    productContextCode?: string | null;
    contextCategorySlug?: string | null;
    recentMessages?: Array<{ role: "assistant" | "user"; text: string }>;
  }): Promise<ShopAssistantReply> {
    const trimmedMessage = input.message.trim();
    const normalized = normalizeAssistantText(trimmedMessage);
    const baseData = await repository.getBaseData();
    const whatsappHref = buildPublicWhatsappHref();
    const recentConversation = (input.recentMessages ?? [])
      .map((item) => normalizeAssistantText(item.text))
      .filter(Boolean)
      .join(" ");

    if (!trimmedMessage) {
      return {
        text: `Puedo ayudarte a buscar productos por código, nombre, categoría, ofertas o compra por WhatsApp en ${baseData.settings.businessName}.`,
        quickActions: buildQuickActions([
          { label: "Ver ofertas", href: "/?featured=1", accent: true },
          { label: "Buscar catálogo", href: "/?focus=search" },
        ]),
        suggestedPrompts: buildDefaultPrompts(),
      };
    }

    const matchedCategory = baseData.categories.find((category) => {
      const normalizedName = normalizeAssistantText(category.name);
      const normalizedSlug = category.slug.replace(/-/g, " ");
      return (
        normalized.includes(normalizedName) ||
        normalized.includes(normalizedSlug) ||
        recentConversation.includes(normalizedName) ||
        recentConversation.includes(normalizedSlug)
      );
    });
    const contextCategory =
      matchedCategory ??
      baseData.categories.find((category) => category.slug === input.contextCategorySlug) ??
      null;

    const wantsOffers = /(oferta|ofertas|promo|promocion|promociones|destacado|destacados)/.test(
      normalized,
    );
    const wantsCategories = /(categoria|categorias|rubro|rubros|seccion|secciones)/.test(
      normalized,
    );
    const wantsSupport =
      /(whatsapp|contacto|horario|hora|pedido|comprar|compra|envio|entrega|delivery|pago|cotizacion|cotizar)/.test(
        normalized,
      );
    const wantsGift = isGiftIntent(`${trimmedMessage} ${recentConversation}`);
    const wantsSimilar = /(similar|parecid|alternativ|relacionad)/.test(normalized);
    const wantsCheaper = /(barat|econom|menor precio|menos precio|mas barato|más barato)/.test(
      normalized,
    );
    const wantsStock = /(stock|disponible|disponibilidad|queda|quedan|tienes|hay)/.test(
      normalized,
    );
    const wantsContinuation = /(mas|más|otra|otro|otras|otros|ver mas|ver más|muestrame mas|muestrame más)/.test(
      normalized,
    );
    const code = extractProductCode(trimmedMessage) ?? input.productContextCode ?? null;
    const searchTerms = extractSearchTerms(trimmedMessage);
    const budget = extractBudget(trimmedMessage);
    const quantity = extractQuantity(trimmedMessage);
    const allowSensitiveProducts = isAdultIntent(`${trimmedMessage} ${recentConversation}`);
    const contextProduct = code ? await repository.findProductByCode(code) : null;

    if (wantsOffers) {
      const featuredProducts = await repository.getFeaturedProducts();
      const products =
        featuredProducts.length > 0
          ? filterSensitiveProducts(featuredProducts, allowSensitiveProducts)
          : await getFallbackRecommendationProducts(repository, allowSensitiveProducts);
      return {
        text: products.length
          ? featuredProducts.length > 0
            ? "Estas son las ofertas activas con mejor salida en el catálogo."
            : "No veo ofertas activas marcadas ahora; te muestro opciones recomendadas por stock y rotación."
          : "Aún no hay ofertas activas ni recomendaciones visibles en el catálogo.",
        products: products.map((product) =>
          mapAssistantProduct(product, baseData.settings.currencySymbol),
        ),
        quickActions: buildQuickActions([
          { label: "Abrir ofertas", href: "/?featured=1", accent: true },
          { label: "Comprar por WhatsApp", href: whatsappHref },
        ]),
        suggestedPrompts: [
          "Algo para regalar por cumpleaños",
          "Busca por código",
          "¿Cómo envío mi pedido?",
        ],
      };
    }

    if (matchedCategory && !wantsSupport) {
      const products = await repository.getCategoryProducts(matchedCategory.id);
      return {
        text: products.length
          ? `En ${matchedCategory.name} encontré estas opciones para empezar rápido.`
          : `La categoría ${matchedCategory.name} existe, pero ahora no tiene productos visibles.`,
        contextCategorySlug: matchedCategory.slug,
        products: products.map((product) =>
          mapAssistantProduct(product, baseData.settings.currencySymbol),
        ),
        quickActions: buildQuickActions([
          {
            label: `Ver ${matchedCategory.name}`,
            href: `/?category=${encodeURIComponent(matchedCategory.slug)}`,
            accent: true,
          },
          { label: "Ver ofertas", href: "/?featured=1" },
        ]),
        suggestedPrompts: [
          `Busca ${matchedCategory.name} por código`,
          "¿Qué ofertas hay?",
          "¿Cómo envío mi pedido?",
        ],
      };
    }

    if (contextCategory && wantsContinuation && !wantsSupport) {
      const products = await repository.getCategoryProducts(contextCategory.id);
      return {
        text: products.length
          ? `Sigo en ${contextCategory.name}. Estas son más opciones dentro de esa línea.`
          : `Ahora mismo no veo más productos visibles en ${contextCategory.name}.`,
        contextCategorySlug: contextCategory.slug,
        products: products.map((product) =>
          mapAssistantProduct(product, baseData.settings.currencySymbol),
        ),
        quickActions: buildQuickActions([
          {
            label: `Ver ${contextCategory.name}`,
            href: `/?category=${encodeURIComponent(contextCategory.slug)}`,
            accent: true,
          },
          { label: "Ver ofertas", href: "/?featured=1" },
        ]),
        suggestedPrompts: [
          "Busca por código",
          "¿Cómo cotizo mi pedido?",
          "Muéstrame ofertas",
        ],
      };
    }

    if (wantsCategories) {
      const topCategories = baseData.categories.slice(0, 6);
      return {
        text: topCategories.length
          ? `Estas son algunas categorías activas del catálogo: ${topCategories.map((item) => item.name).join(", ")}.`
          : "Todavía no hay categorías activas configuradas.",
        quickActions: topCategories.map((category, index) => ({
          label: category.name,
          href: `/?category=${encodeURIComponent(category.slug)}`,
          accent: index === 0,
        })),
        suggestedPrompts: [
          "Muéstrame ofertas",
          "Busca por código",
          "¿Cómo compro por WhatsApp?",
        ],
      };
    }

    if (wantsSupport) {
      return {
        text:
          `Puedes armar el carrito, revisar si ya aplica el precio mayorista y luego pulsar “Registrar cotización ERP” o “Enviar pedido” por WhatsApp. ` +
          `Horario configurado: ${baseData.settings.supportHours}. ` +
          "Si necesitas confirmar entrega o pago, conviene cerrar el pedido por WhatsApp.",
        quickActions: buildQuickActions([
          { label: "Ir al catálogo", href: "/?focus=search", accent: true },
          { label: "Cotizar pedido", href: "/?drawer=cart" },
          { label: "WhatsApp", href: whatsappHref },
          { label: "Ver ofertas", href: "/?featured=1" },
        ]),
        suggestedPrompts: [
          "Busca un producto por código",
          "Muéstrame productos destacados",
          "¿Qué categorías tienes?",
        ],
      };
    }

    if (wantsGift) {
      const giftQueries = buildGiftSearchQueries(trimmedMessage, recentConversation);
      const giftProducts = await gatherProductsFromQueries(
        repository,
        giftQueries,
        allowSensitiveProducts,
      );
      const sortedGiftProducts = budget
        ? sortProductsForBudget(giftProducts, giftQueries.join(" "), budget)
        : quantity
          ? sortProductsForQuantity(giftProducts, quantity)
          : giftProducts.slice(0, MAX_PRODUCTS);
      const visibleGiftProducts = sortedGiftProducts.slice(0, MAX_PRODUCTS);
      const occasion = detectGiftOccasion(`${trimmedMessage} ${recentConversation}`);
      const opening =
        visibleGiftProducts.length > 0
          ? occasion
            ? `Para ${occasion} te dejo opciones que suelen funcionar bien como regalo.`
            : "Te dejo opciones que suelen funcionar bien como regalo."
          : occasion
            ? `Para ${occasion} no encontré una coincidencia exacta, pero sí puedo afinarlo si me dices presupuesto o para quién es.`
            : "No encontré una coincidencia exacta, pero sí puedo afinarlo si me dices presupuesto o para quién es.";

      return {
        text: budget
          ? `${opening} La mejor opción cercana a ${formatCurrency(budget, baseData.settings.currencySymbol)} es la primera de la lista.`
          : opening,
        products: visibleGiftProducts.map((product) =>
          mapAssistantProduct(product, baseData.settings.currencySymbol),
        ),
        quickActions: buildQuickActions([
          { label: "Buscar más ideas", href: "/?focus=search", accent: true },
          { label: "Ver ofertas", href: "/?featured=1" },
          { label: "WhatsApp", href: whatsappHref },
        ]),
        suggestedPrompts: [
          budget
            ? `Algo para regalar por ${occasion ?? "cumpleaños"} con menos de ${formatCurrency(budget, baseData.settings.currencySymbol)}`
            : "Algo para regalar por cumpleaños",
          "Algo útil para oficina",
          "Algo para ella",
        ],
      };
    }

    if (contextProduct && quantity && !wantsSupport) {
      if (contextProduct.isVisible === false || contextProduct.stockUnits <= 0) {
        return {
          text: `${contextProduct.name} existe, pero no está disponible ahora. Te busco una alternativa visible.`,
          contextProductCode: contextProduct.code,
          quickActions: buildQuickActions([
            { label: "Buscar similares", href: `/?q=${encodeURIComponent(contextProduct.category ?? contextProduct.name)}`, accent: true },
            { label: "WhatsApp", href: whatsappHref },
          ]),
          suggestedPrompts: ["Muéstrame algo similar", "Más barato", "¿Cómo cotizo?"],
        };
      }

      const effectivePrice = getEffectivePrice(contextProduct, quantity);
      const total = effectivePrice * quantity;
      const wholesaleNote =
        contextProduct.wholesalePrice !== null && quantity >= contextProduct.wholesaleMinQty
          ? `Ya aplica mayorista: ${formatCurrency(effectivePrice, baseData.settings.currencySymbol)} c/u.`
          : contextProduct.wholesalePrice !== null
            ? `Para mayorista necesitas ${contextProduct.wholesaleMinQty} unidades.`
            : "Este producto mantiene precio unitario.";

      return {
        text: `La mejor opción es ${contextProduct.name}. ${wholesaleNote} Total estimado por ${quantity}: ${formatCurrency(total, baseData.settings.currencySymbol)}.`,
        contextProductCode: contextProduct.code,
        contextCategorySlug: contextProduct.categoryId
          ? baseData.categories.find((category) => category.id === contextProduct.categoryId)?.slug ?? null
          : null,
        products: [
          mapAssistantProduct(
            withRecommendation(
              contextProduct,
              getSalesReason(
                contextProduct,
                { budget, quantity },
                baseData.settings.currencySymbol,
              ),
              quantity,
            ),
            baseData.settings.currencySymbol,
          ),
        ],
        quickActions: buildQuickActions([
          { label: "Abrir carrito", href: "/?drawer=cart", accent: true },
          { label: "Ver producto", href: `/producto/${encodeURIComponent(contextProduct.slug)}` },
        ]),
        suggestedPrompts: ["Muéstrame algo más barato", "Mejor uno con bluetooth", "¿Cómo compro?"],
      };
    }

    if (contextProduct && wantsSimilar) {
      const related = filterSensitiveProducts(
        await repository.getRelatedProducts(contextProduct),
        allowSensitiveProducts,
      );
      return {
        text: related.length
          ? `La mejor alternativa cercana a ${contextProduct.name} es ${related[0].name}.`
          : `No encontré productos similares visibles para ${contextProduct.name} en este momento.`,
        contextProductCode: contextProduct.code,
        contextCategorySlug: contextProduct.categoryId
          ? baseData.categories.find((category) => category.id === contextProduct.categoryId)?.slug ?? null
          : null,
        products: applySalesRecommendations(
          related,
          { budget, quantity },
          baseData.settings.currencySymbol,
        ).map((product) =>
          mapAssistantProduct(product, baseData.settings.currencySymbol),
        ),
        quickActions: buildQuickActions([
          {
            label: "Ver producto base",
            href: `/producto/${encodeURIComponent(contextProduct.slug)}`,
            accent: true,
          },
          { label: "Ver ofertas", href: "/?featured=1" },
        ]),
        suggestedPrompts: [
          "¿Y por mayor cuánto cuesta?",
          "¿Cómo envío mi pedido?",
          "Busca por código",
        ],
      };
    }

    if (contextProduct && wantsCheaper && !wantsSupport) {
      const alternativeQuery =
        extractSearchTerms(contextProduct.description ?? contextProduct.name) ||
        extractSearchTerms(contextProduct.name) ||
        contextProduct.category ||
        contextProduct.name;
      const related = filterSensitiveProducts(
        await repository.searchVisibleProducts(alternativeQuery),
        allowSensitiveProducts,
      )
        .filter((product) => product.id !== contextProduct.id)
        .filter((product) => getProductUnitPrice(product) < getProductUnitPrice(contextProduct))
        .sort((left, right) => getProductUnitPrice(left) - getProductUnitPrice(right))
        .slice(0, MAX_PRODUCTS);

      return {
        text: related.length
          ? `La mejor opción más barata es ${related[0].name} a ${formatCurrency(getProductUnitPrice(related[0]), baseData.settings.currencySymbol)}. También puedes considerar estas alternativas.`
          : `No encontré una opción más barata visible que ${contextProduct.name} en la misma línea.`,
        contextProductCode: related[0]?.code ?? contextProduct.code,
        contextCategorySlug: contextProduct.categoryId
          ? baseData.categories.find((category) => category.id === contextProduct.categoryId)?.slug ?? null
          : null,
        products: applySalesRecommendations(
          related,
          { budget, quantity },
          baseData.settings.currencySymbol,
        ).map((product) =>
          mapAssistantProduct(product, baseData.settings.currencySymbol),
        ),
        quickActions: buildQuickActions([
          { label: "Ver resultados", href: `/?q=${encodeURIComponent(contextProduct.category ?? contextProduct.name)}`, accent: true },
          { label: "Abrir carrito", href: "/?drawer=cart" },
        ]),
        suggestedPrompts: ["Mejor uno con bluetooth", "Quiero 12 unidades", "¿Cómo cotizo?"],
      };
    }

    if (contextProduct) {
      if (contextProduct.isVisible === false || contextProduct.stockUnits <= 0) {
        return {
          text:
            `${contextProduct.name} (${contextProduct.code}) existe en el ERP, pero ahora no está visible en la tienda porque no tiene stock disponible.` +
            " Si quieres, puedo ayudarte a buscar una alternativa visible o puedes confirmarlo por WhatsApp.",
          contextProductCode: contextProduct.code,
          quickActions: buildQuickActions([
            { label: "Buscar alternativas", href: `/?q=${encodeURIComponent(contextProduct.code)}`, accent: true },
            { label: "WhatsApp", href: whatsappHref },
            { label: "Ver ofertas", href: "/?featured=1" },
          ]),
          suggestedPrompts: [
            "Busca algo similar",
            "Muéstrame ofertas",
            "¿Cómo cotizo mi pedido?",
          ],
        };
      }

      const stockWarning =
        wantsStock && contextProduct.stockUnits <= 12
          ? contextProduct.stockUnits <= 0
            ? " Ojo: el catálogo sincronizado lo marca sin stock."
            : " Ojo: el stock está bajo, conviene confirmar antes de cerrar el pedido."
          : "";
      return {
        text: `${formatProductAnswer(contextProduct, baseData.settings.currencySymbol)}${stockWarning}`,
        contextProductCode: contextProduct.code,
        contextCategorySlug: contextProduct.categoryId
          ? baseData.categories.find((category) => category.id === contextProduct.categoryId)?.slug ?? null
          : null,
        products: [mapAssistantProduct(contextProduct, baseData.settings.currencySymbol)],
        quickActions: buildQuickActions([
          {
            label: "Ver producto",
            href: `/producto/${encodeURIComponent(contextProduct.slug)}`,
            accent: true,
          },
          { label: "Ir al catálogo", href: `/?q=${encodeURIComponent(contextProduct.code)}` },
        ]),
        suggestedPrompts: [
          "¿Y por mayor cuánto cuesta?",
          "¿Hay algo similar?",
          "¿Cómo envío mi pedido?",
        ],
      };
    }

    if (searchTerms) {
      const products = filterSensitiveProducts(
        await repository.searchVisibleProducts(searchTerms),
        allowSensitiveProducts,
      );
      const sortedProducts = quantity
        ? sortProductsForQuantity(products, quantity)
        : budget
          ? sortProductsForBudget(products, searchTerms, budget)
          : products.slice(0, MAX_PRODUCTS);
      const visibleProducts = sortedProducts.slice(0, MAX_PRODUCTS);
      const recommendedProducts = applySalesRecommendations(
        visibleProducts,
        { budget, quantity },
        baseData.settings.currencySymbol,
      );

      if (visibleProducts.length === 1) {
        const product = visibleProducts[0];
        return {
          text: budget
            ? `La opción más cercana a ${formatCurrency(budget, baseData.settings.currencySymbol)} es: ${formatProductAnswer(product, baseData.settings.currencySymbol)}`
            : formatProductAnswer(product, baseData.settings.currencySymbol),
          contextProductCode: product.code,
          contextCategorySlug: product.categoryId
            ? baseData.categories.find((category) => category.id === product.categoryId)?.slug ?? null
            : null,
          products: [mapAssistantProduct(product, baseData.settings.currencySymbol)],
          quickActions: buildQuickActions([
            {
              label: "Ver producto",
              href: `/producto/${encodeURIComponent(product.slug)}`,
              accent: true,
            },
            { label: "Buscar más", href: `/?q=${encodeURIComponent(searchTerms)}` },
          ]),
          suggestedPrompts: [
            "¿Y el precio mayorista?",
            "¿Tienes algo parecido?",
            "¿Cómo lo compro?",
          ],
        };
      }

      if (visibleProducts.length > 1) {
        const closestProduct = visibleProducts[0];
        const closestPrice = formatCurrency(
          getEffectivePrice(closestProduct, quantity),
          baseData.settings.currencySymbol,
        );

        return {
          text: quantity
            ? `La mejor opción para ${quantity} unidades es ${closestProduct.name} a ${closestPrice} c/u. ${closestProduct.wholesalePrice !== null && quantity >= closestProduct.wholesaleMinQty ? "Ya aplica precio mayorista." : "También te dejo alternativas."}`
            : budget
              ? `La mejor opción es ${closestProduct.name} a ${closestPrice}: es la más cercana a ${formatCurrency(budget, baseData.settings.currencySymbol)}. También puedes considerar estas alternativas.`
              : `La mejor opción es ${closestProduct.name}. También puedes considerar estas alternativas con stock.`,
          contextProductCode: closestProduct.code,
          contextCategorySlug: closestProduct.categoryId
            ? baseData.categories.find((category) => category.id === closestProduct.categoryId)?.slug ?? null
            : null,
          products: recommendedProducts.map((product) =>
            mapAssistantProduct(product, baseData.settings.currencySymbol),
          ),
          quickActions: buildQuickActions([
            {
              label: "Ver resultados",
              href: `/?q=${encodeURIComponent(searchTerms)}`,
              accent: true,
            },
            { label: "Ver ofertas", href: "/?featured=1" },
          ]),
          suggestedPrompts: [
            "Muéstrame algo más barato",
            "Quiero 12 unidades",
            "Busca por código exacto",
          ],
        };
      }
    }

    return {
      text:
        `No encontré una coincidencia clara para “${trimmedMessage}”. ` +
        "Prueba con un código, un nombre corto, una categoría o pídele ofertas activas.",
      quickActions: buildQuickActions([
        { label: "Buscar catálogo", href: "/?focus=search", accent: true },
        { label: "Ver ofertas", href: "/?featured=1" },
        { label: "WhatsApp", href: whatsappHref },
      ]),
      suggestedPrompts: buildDefaultPrompts(),
    };
  };
}

const realRepository = createRealRepository();
const answerWithRealRepository = createShopAssistantService(realRepository);

export async function answerShopAssistant(input: {
  message: string;
  productContextCode?: string | null;
  contextCategorySlug?: string | null;
  recentMessages?: Array<{ role: "assistant" | "user"; text: string }>;
}): Promise<ShopAssistantReply> {
  return answerWithRealRepository(input);
}
