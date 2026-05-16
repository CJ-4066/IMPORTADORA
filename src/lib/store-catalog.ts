import { getErpBestSellerSnapshot } from "@/lib/erp-sales";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_PAGE_SIZE,
  buildWhere,
  buildRealProductPhotoWhere,
  getStoreSettings,
  mapCategory,
  mapProduct,
  mapSuggestionResults,
} from "@/lib/store-shared";
import type { BrandOption, CatalogSalesSummary, CatalogSuggestion } from "@/lib/store-types";

const EMPTY_SALES_SUMMARY: CatalogSalesSummary = {
  generatedAt: null,
  hasDatedSales: false,
  hasRealSales: false,
  hasUnitSales: false,
  insights: [
    { label: "15 días", value: "Sin ventas ERP" },
    { label: "Rotación", value: "Sin unidades" },
  ],
  source: "fallback",
};

export async function getCatalogPageData(input: {
  query?: string;
  category?: string;
  brand?: string;
  page?: number;
  featuredOnly?: boolean;
  collection?: string;
  sort?: string;
}) {
  const page = Math.max(1, input.page ?? 1);
  const collection = input.collection?.trim().toLowerCase() ?? "";
  const needsBestSellerSnapshot = shouldLoadBestSellerSnapshot(input, page, collection);
  const bestSellerSnapshot = needsBestSellerSnapshot
    ? await getErpBestSellerSnapshot(PUBLIC_PAGE_SIZE * 8)
    : {
        codes: [],
        summary: EMPTY_SALES_SUMMARY,
      };
  const bestSellerCodes = bestSellerSnapshot.codes;
  const shouldRankBestSellers = collection === "mas-vendidos" && bestSellerCodes.length > 0;
  const where = buildCatalogWhere(input, shouldRankBestSellers ? bestSellerCodes : []);
  const [queriedProducts, bestSellerRows, totalResults, categoryRows, brandRows, visibleCount, featuredCount, settings] =
    await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          media: {
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy:
          collection === "mas-vendidos" ? [{ updatedAt: "desc" }] : getCatalogOrderBy(input.sort),
        skip: shouldRankBestSellers ? undefined : (page - 1) * PUBLIC_PAGE_SIZE,
        take: shouldRankBestSellers ? undefined : PUBLIC_PAGE_SIZE,
      }),
      bestSellerCodes.length
        ? prisma.product.findMany({
            where: buildBestSellerProductsWhere(bestSellerCodes),
            include: {
              media: {
                orderBy: { sortOrder: "asc" },
              },
            },
          })
        : [],
      prisma.product.count({ where }),
      prisma.category.findMany({
        where: {
          products: {
            some: {
              AND: [{ isVisible: true }, { stockUnits: { gt: 0 } }, buildRealProductPhotoWhere()],
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({
        where: {
          isVisible: true,
          stockUnits: { gt: 0 },
          brand: { not: null },
          ...buildRealProductPhotoWhere(),
        },
        distinct: ["brand"],
        orderBy: { brand: "asc" },
        select: { brand: true },
      }),
      prisma.product.count({ where: { AND: [{ isVisible: true }, { stockUnits: { gt: 0 } }, buildRealProductPhotoWhere()] } }),
      prisma.product.count({
        where: { AND: [{ isVisible: true }, { isFeatured: true }, { stockUnits: { gt: 0 } }, buildRealProductPhotoWhere()] },
      }),
      getStoreSettings(),
    ]);
  const orderedProducts =
    shouldRankBestSellers ? rankProductsByCode(queriedProducts, bestSellerCodes) : queriedProducts;
  const products = shouldRankBestSellers
    ? orderedProducts.slice((page - 1) * PUBLIC_PAGE_SIZE, page * PUBLIC_PAGE_SIZE)
    : orderedProducts;
  const bestSellerProducts = bestSellerCodes.length
    ? rankProductsByCode(bestSellerRows, bestSellerCodes)
        .slice(0, 12)
        .map(mapProduct)
    : [];

  return {
    bestSellerProducts,
    products: products.map(mapProduct),
    salesSummary: bestSellerSnapshot.summary,
    totalResults,
    totalPages: Math.max(1, Math.ceil(totalResults / PUBLIC_PAGE_SIZE)),
    page,
    featuredOnly: Boolean(input.featuredOnly),
    selectedBrand: input.brand?.trim() || "all",
    selectedSort: input.sort?.trim() || "featured",
    categories: categoryRows.map(mapCategory),
    brands: brandRows
      .map((item) => item.brand?.trim())
      .filter((value): value is string => Boolean(value))
      .map((name) => ({ name })) satisfies BrandOption[],
    stats: {
      visibleCount,
      featuredCount,
    },
    settings,
  };
}

function shouldLoadBestSellerSnapshot(
  input: {
    query?: string;
    category?: string;
    brand?: string;
    featuredOnly?: boolean;
  },
  page: number,
  collection: string,
) {
  if (collection === "mas-vendidos") {
    return true;
  }

  return (
    page === 1 &&
    !input.query?.trim() &&
    (input.category?.trim() || "all") === "all" &&
    (input.brand?.trim() || "all") === "all" &&
    !collection &&
    !input.featuredOnly
  );
}

function getCatalogOrderBy(sort?: string) {
  switch (sort) {
    case "price-asc":
      return [{ unitPrice: "asc" as const }, { updatedAt: "desc" as const }];
    case "price-desc":
      return [{ unitPrice: "desc" as const }, { updatedAt: "desc" as const }];
    case "newest":
      return [{ updatedAt: "desc" as const }];
    case "featured":
    default:
      return [{ isFeatured: "desc" as const }, { updatedAt: "desc" as const }];
  }
}

function buildCatalogWhere(
  input: {
    query?: string;
    category?: string;
    brand?: string;
    collection?: string;
    featuredOnly?: boolean;
  },
  bestSellerCodes: string[],
) {
  const where = buildWhere(input.query, input.category, input.brand, true, input.featuredOnly);
  const collectionWhere = getCollectionWhere(input.collection);
  const conditions: Prisma.ProductWhereInput[] = [where];

  if (collectionWhere) {
    conditions.push(collectionWhere);
  }

  if (bestSellerCodes.length) {
    conditions.push({
      OR: [
        { code: { in: bestSellerCodes } },
        { externalCode: { in: bestSellerCodes } },
        { externalId: { in: bestSellerCodes } },
      ],
    });
  }

  return { AND: conditions };
}

function getCollectionWhere(collection?: string): Prisma.ProductWhereInput | null {
  switch (collection) {
    case "drones":
      return {
        OR: [
          { name: { contains: "dron", mode: "insensitive" } },
          { code: { contains: "dron", mode: "insensitive" } },
          { name: { contains: "dji mini", mode: "insensitive" } },
          { name: { contains: "dji avata", mode: "insensitive" } },
          { name: { contains: "dji neo", mode: "insensitive" } },
        ],
      };
    case "consolas":
      return {
        AND: [
          {
            OR: [
              { name: { contains: "consola", mode: "insensitive" } },
              { name: { contains: "videojuego", mode: "insensitive" } },
              { name: { contains: "video juego", mode: "insensitive" } },
              { name: { contains: "gamestick", mode: "insensitive" } },
              { name: { contains: "game stick", mode: "insensitive" } },
              { name: { contains: "game player", mode: "insensitive" } },
              { name: { contains: "r36s", mode: "insensitive" } },
            ],
          },
          {
            NOT: [
              { name: { contains: "consolador", mode: "insensitive" } },
            ],
          },
        ],
      };
    default:
      return null;
  }
}

function buildBestSellerProductsWhere(bestSellerCodes: string[]) {
  return {
    AND: [
      { isVisible: true },
      { stockUnits: { gt: 0 } },
      buildRealProductPhotoWhere(),
      {
        OR: [
          { code: { in: bestSellerCodes } },
          { externalCode: { in: bestSellerCodes } },
          { externalId: { in: bestSellerCodes } },
        ],
      },
    ],
  };
}

function rankProductsByCode<T extends { code: string; externalCode: string | null; externalId: string | null }>(
  products: T[],
  rankedCodes: string[],
) {
  const rank = new Map(rankedCodes.map((code, index) => [code, index]));

  return products.slice().sort((left, right) => {
    const leftRank = getProductRank(left, rank);
    const rightRank = getProductRank(right, rank);
    return leftRank - rightRank;
  });
}

function getProductRank(
  product: { code: string; externalCode: string | null; externalId: string | null },
  rank: Map<string, number>,
) {
  for (const candidate of [product.code, product.externalCode, product.externalId]) {
    if (!candidate) {
      continue;
    }

    const value = rank.get(candidate);

    if (value !== undefined) {
      return value;
    }
  }

  return Number.MAX_SAFE_INTEGER;
}

export async function getCatalogSuggestions(query: string) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [] satisfies CatalogSuggestion[];
  }

  const products = await prisma.product.findMany({
    where: {
      isVisible: true,
      stockUnits: { gt: 0 },
      AND: [buildRealProductPhotoWhere()],
      OR: [
        { code: { contains: trimmedQuery, mode: "insensitive" } },
        { name: { contains: trimmedQuery, mode: "insensitive" } },
        { brand: { contains: trimmedQuery, mode: "insensitive" } },
        { category: { contains: trimmedQuery, mode: "insensitive" } },
      ],
    },
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    take: 10,
  });

  return mapSuggestionResults(products, trimmedQuery);
}

export async function getCatalogProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      isVisible: true,
      stockUnits: { gt: 0 },
      AND: [buildRealProductPhotoWhere()],
    },
    include: {
      media: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!product) {
    return null;
  }

  const [settings, relatedProducts] = await Promise.all([
    getStoreSettings(),
    prisma.product.findMany({
      where: {
        id: { not: product.id },
        isVisible: true,
        stockUnits: { gt: 0 },
        ...(product.categoryId
          ? { categoryId: product.categoryId }
          : product.category
            ? { category: product.category }
            : {}),
        AND: [buildRealProductPhotoWhere()],
      },
      include: {
        media: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      take: 4,
    }),
  ]);

  return {
    product: mapProduct(product),
    relatedProducts: relatedProducts.map(mapProduct),
    settings,
  };
}

export async function getCategoryOptions() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return categories.map(mapCategory);
}

export async function getBrandOptions() {
  const brands = await prisma.product.findMany({
    where: {
      isVisible: true,
      stockUnits: { gt: 0 },
      brand: { not: null },
      AND: [buildRealProductPhotoWhere()],
    },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
    select: { brand: true },
  });

  return brands
    .map((item) => item.brand?.trim())
    .filter((value): value is string => Boolean(value))
    .map((name) => ({ name })) satisfies BrandOption[];
}
