import type {
  Category,
  ErpSyncLog,
  Prisma,
  Product,
  ProductMedia as PrismaProductMedia,
  TrendDirection,
} from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type {
  CatalogProduct,
  CatalogSuggestion,
  CategoryOption,
  DashboardComparisonMetric,
  DashboardTrendProduct,
  ErpSyncLogView,
  HeroSlideView,
  ProductMediaView,
  StoreSettingsView,
} from "@/lib/store-types";

export const PUBLIC_PAGE_SIZE = 24;
export const ADMIN_PAGE_SIZE = 10;

const BRAND_BLUE = "#292c95";
const LEGACY_PRIMARY_BLUE = "#147cc4";
const GENERIC_PRODUCT_PHOTO_MARKERS = [
  "imagen-no-disponible",
  "no-image",
  "placeholder",
  "sin-foto",
];
export const GENERIC_PRODUCT_PHOTO_URLS = [
  "https://original.negocioserp.com/logo/imagen-no-disponible.jpg",
];
const GENERIC_PRODUCT_PHOTO_FILTER_URLS = [...GENERIC_PRODUCT_PHOTO_URLS, ""];

const DEFAULT_STORE_SETTINGS: StoreSettingsView = {
  businessName: "Importaciones Super",
  heroTitle: "Catálogo mayorista con pedido directo por WhatsApp",
  heroDescription:
    "Explora el stock disponible, arma tu pedido y envíalo en segundos sin llamadas ni pasos innecesarios.",
  heroSlides: [],
  heroAutoplaySeconds: 5,
  whatsappNumber: "51999999999",
  orderIntro: "Hola, quiero cotizar estos productos:",
  orderFooter: "Quedo atento a la confirmación de stock y total final.",
  currencySymbol: "S/",
  highlightMessage: "Precios por unidad y mayorista sincronizados con el ERP.",
  supportHours: "Lun a sáb 8:00 am - 7:00 pm",
  primaryColor: BRAND_BLUE,
  accentColor: BRAND_BLUE,
};

type ProductWithMedia = Product & {
  media: PrismaProductMedia[];
};

type ProductPhotoSource = {
  imageUrl: string | null;
  media: Array<{ url: string }>;
};

export function isGenericProductPhotoUrl(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return false;
  }

  if (GENERIC_PRODUCT_PHOTO_URLS.some((photoUrl) => photoUrl === normalized)) {
    return true;
  }

  return GENERIC_PRODUCT_PHOTO_MARKERS.some((marker) => normalized.includes(marker));
}

export function hasRealProductPhoto(product: ProductPhotoSource) {
  const imageUrl = product.imageUrl?.trim() ?? "";
  const mediaUrls = product.media.map((item) => item.url.trim()).filter((value) => value.length > 0);

  return [imageUrl, ...mediaUrls].some((value) => value.length > 0 && !isGenericProductPhotoUrl(value));
}

export function hasProductPhoto(product: ProductPhotoSource) {
  return hasRealProductPhoto(product);
}

export function buildRealProductPhotoWhere(): Prisma.ProductWhereInput {
  return {
    OR: [
      {
        AND: [
          { imageUrl: { not: null } },
          { imageUrl: { notIn: GENERIC_PRODUCT_PHOTO_FILTER_URLS } },
        ],
      },
      {
        media: {
          some: {
            url: { notIn: GENERIC_PRODUCT_PHOTO_FILTER_URLS },
          },
        },
      },
    ],
  };
}

export function buildSellableProductWhere(): Prisma.ProductWhereInput {
  // CHANGE-CODE: CAT-001
  return {
    isVisible: true,
    stockUnits: { gt: 0 },
    AND: [buildRealProductPhotoWhere()],
  };
}

export function buildMissingProductPhotoWhere(): Prisma.ProductWhereInput {
  return {
    OR: [
      { imageUrl: null },
      { imageUrl: "" },
      { imageUrl: { in: GENERIC_PRODUCT_PHOTO_URLS } },
      {
        imageUrl: {
          contains: "imagen-no-disponible",
          mode: "insensitive",
        },
      },
      {
        imageUrl: {
          contains: "no-image",
          mode: "insensitive",
        },
      },
      {
        imageUrl: {
          contains: "placeholder",
          mode: "insensitive",
        },
      },
      {
        imageUrl: {
          contains: "sin-foto",
          mode: "insensitive",
        },
      },
    ],
    media: {
      none: {
        url: {
          notIn: GENERIC_PRODUCT_PHOTO_FILTER_URLS,
        },
      },
    },
  };
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function mapMedia(media: PrismaProductMedia): ProductMediaView {
  return {
    id: media.id,
    type: media.type,
    url: media.url,
    altText: media.altText,
    sortOrder: media.sortOrder,
  };
}

export function mapProduct(product: ProductWithMedia): CatalogProduct {
  const media = product.media
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(mapMedia);
  const realMedia = media.find((item) => !isGenericProductPhotoUrl(item.url));
  const primaryMedia =
    realMedia ??
    (product.imageUrl && !isGenericProductPhotoUrl(product.imageUrl)
      ? {
          id: "legacy-image",
          type: "IMAGE" as const,
          url: product.imageUrl,
          altText: product.name,
          sortOrder: 0,
        }
      : null);

  return {
    id: product.id,
    code: product.code,
    slug: product.slug,
    name: product.name,
    description: product.description,
    technicalSpecs: product.technicalSpecs,
    brand: product.brand,
    category: product.category,
    categoryId: product.categoryId,
    imageUrl: product.imageUrl,
    media,
    primaryMedia,
    unitLabel: product.unitLabel,
    unitPrice: Number(product.unitPrice),
    wholesalePrice: toNumber(product.wholesalePrice),
    wholesaleMinQty: product.wholesaleMinQty,
    boxPrice: toNumber(product.boxPrice),
    unitsPerBox: product.unitsPerBox,
    stockUnits: product.stockUnits,
    isVisible: product.isVisible,
    isFeatured: product.isFeatured,
    syncEnabled: product.syncEnabled,
    hasPhoto: hasRealProductPhoto({ imageUrl: product.imageUrl, media: product.media }),
    lastSyncedAt: product.lastSyncedAt?.toISOString() ?? null,
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function mapCategory(category: Category): CategoryOption {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
  };
}

const readStoreSettingsRecord = cache(async () =>
  prisma.storeSettings.findUnique({ where: { id: 1 } }),
);

function parseHeroSlides(value: Prisma.JsonValue | null | undefined): HeroSlideView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const imageUrl =
        "imageUrl" in entry && typeof entry.imageUrl === "string" ? entry.imageUrl : "";
      const title =
        "title" in entry && typeof entry.title === "string" && entry.title.trim()
          ? entry.title
          : null;
      const text =
        "text" in entry && typeof entry.text === "string" && entry.text.trim()
          ? entry.text
          : null;

      if (!imageUrl.trim()) {
        return null;
      }

      return {
        imageUrl,
        title,
        text,
      } satisfies HeroSlideView;
    })
    .filter((entry): entry is HeroSlideView => Boolean(entry));
}

function mapStoreSettings(
  settings: Awaited<ReturnType<typeof readStoreSettingsRecord>>,
): StoreSettingsView {
  const storedPrimaryColor = settings?.primaryColor?.toLowerCase() ?? null;
  const primaryColor =
    storedPrimaryColor === LEGACY_PRIMARY_BLUE || storedPrimaryColor === "#0b86d1"
      ? BRAND_BLUE
      : settings?.primaryColor ?? DEFAULT_STORE_SETTINGS.primaryColor;

  return {
    businessName: settings?.businessName ?? DEFAULT_STORE_SETTINGS.businessName,
    heroTitle: settings?.heroTitle ?? DEFAULT_STORE_SETTINGS.heroTitle,
    heroDescription: settings?.heroDescription ?? DEFAULT_STORE_SETTINGS.heroDescription,
    heroSlides: parseHeroSlides(settings?.heroSlides),
    heroAutoplaySeconds:
      settings?.heroAutoplaySeconds ?? DEFAULT_STORE_SETTINGS.heroAutoplaySeconds,
    whatsappNumber: settings?.whatsappNumber ?? DEFAULT_STORE_SETTINGS.whatsappNumber,
    orderIntro: settings?.orderIntro ?? DEFAULT_STORE_SETTINGS.orderIntro,
    orderFooter: settings?.orderFooter ?? DEFAULT_STORE_SETTINGS.orderFooter,
    currencySymbol: settings?.currencySymbol ?? DEFAULT_STORE_SETTINGS.currencySymbol,
    highlightMessage: settings?.highlightMessage ?? DEFAULT_STORE_SETTINGS.highlightMessage,
    supportHours: settings?.supportHours ?? DEFAULT_STORE_SETTINGS.supportHours,
    primaryColor,
    accentColor: primaryColor,
  };
}

export async function getStoreSettings(): Promise<StoreSettingsView> {
  return mapStoreSettings(await readStoreSettingsRecord());
}

export function calculateDeltaPercent(currentValue: number, previousValue: number | null) {
  if (previousValue === null || previousValue === 0) {
    return null;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

export function buildComparisonMetric(
  label: string,
  currentValue: number,
  previousValue: number | null,
): DashboardComparisonMetric {
  return {
    label,
    currentValue,
    previousValue,
    deltaPercent: calculateDeltaPercent(currentValue, previousValue),
  };
}

export function mapErpSyncLog(log: ErpSyncLog): ErpSyncLogView {
  const finishedAt = log.finishedAt?.toISOString() ?? null;

  return {
    id: log.id,
    source: log.source,
    trigger: log.trigger,
    status: log.status,
    fetchedCount: log.fetchedCount,
    createdCount: log.createdCount,
    updatedCount: log.updatedCount,
    skippedCount: log.skippedCount,
    errorMessage: log.errorMessage,
    cancelRequestedAt: log.cancelRequestedAt?.toISOString() ?? null,
    initiatedByName: log.initiatedByName,
    initiatedByEmail: log.initiatedByEmail,
    canceledByName: log.canceledByName,
    canceledByEmail: log.canceledByEmail,
    startedAt: log.startedAt.toISOString(),
    finishedAt,
    durationMs: log.finishedAt ? log.finishedAt.getTime() - log.startedAt.getTime() : null,
  };
}

export function buildWhere(
  query?: string,
  category?: string,
  brand?: string,
  visibleOnly = true,
  featuredOnly = false,
): Prisma.ProductWhereInput {
  const trimmedQuery = query?.trim();
  const trimmedCategory = category?.trim();
  const trimmedBrand = brand?.trim();
  const conditions: Prisma.ProductWhereInput[] = [];

  if (visibleOnly) {
    conditions.push(buildSellableProductWhere());
  }

  if (trimmedCategory && trimmedCategory !== "all") {
    conditions.push({
      OR: [{ category: trimmedCategory }, { categoryRef: { slug: trimmedCategory } }],
    });
  }

  if (trimmedBrand && trimmedBrand !== "all") {
    conditions.push({
      brand: {
        equals: trimmedBrand,
        mode: "insensitive",
      },
    });
  }

  if (featuredOnly) {
    conditions.push({ isFeatured: true });
  }

  if (trimmedQuery) {
    conditions.push({
      OR: [
        { name: { contains: trimmedQuery, mode: "insensitive" } },
        { code: { contains: trimmedQuery, mode: "insensitive" } },
        { brand: { contains: trimmedQuery, mode: "insensitive" } },
        { category: { contains: trimmedQuery, mode: "insensitive" } },
      ],
    });
  }

  return conditions.length ? { AND: conditions } : {};
}

function mapSuggestion(product: Product): CatalogSuggestion {
  return {
    id: product.id,
    slug: product.slug,
    code: product.code,
    name: product.name,
    brand: product.brand,
    category: product.category,
  };
}

export function getSuggestionScore(product: Product, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const code = product.code.toLowerCase();
  const name = product.name.toLowerCase();
  const brand = product.brand?.toLowerCase() ?? "";
  const category = product.category?.toLowerCase() ?? "";

  if (code === normalizedQuery) return 100;
  if (name === normalizedQuery) return 96;
  if (code.startsWith(normalizedQuery)) return 92;
  if (name.startsWith(normalizedQuery)) return 88;
  if (brand.startsWith(normalizedQuery)) return 80;
  if (category.startsWith(normalizedQuery)) return 74;
  if (name.includes(normalizedQuery)) return 66;
  if (brand.includes(normalizedQuery)) return 58;
  if (category.includes(normalizedQuery)) return 52;
  if (code.includes(normalizedQuery)) return 48;
  return 0;
}

export function mapCatalogMovementProduct(
  product: Pick<Product, "code" | "name" | "stockUnits" | "lastSyncedAt" | "updatedAt">,
  direction: TrendDirection,
  referenceDate: Date,
): DashboardTrendProduct {
  const activityDate = product.lastSyncedAt ?? product.updatedAt;
  const ageDays = Math.max(
    0,
    Math.floor((referenceDate.getTime() - activityDate.getTime()) / 86_400_000),
  );
  const freshnessScore = Math.max(0, 100 - ageDays * 7);

  return {
    code: product.code,
    name: product.name,
    unitsSold: product.stockUnits,
    deltaPercent: direction === "RISING" ? freshnessScore : -Math.min(100, ageDays * 5),
    momentumScore: direction === "RISING" ? freshnessScore : Math.min(100, ageDays * 5),
    direction,
  };
}

export function mapSuggestionResults(products: Product[], query: string) {
  return products
    .slice()
    .sort(
      (left, right) => getSuggestionScore(right, query) - getSuggestionScore(left, query),
    )
    .slice(0, 6)
    .map(mapSuggestion);
}
