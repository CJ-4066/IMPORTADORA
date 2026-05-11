import { cache } from "react";
import { FacturadorClient } from "@/lib/facturador/client";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_PAGE_SIZE,
  buildWhere,
  getStoreSettings,
  mapCategory,
  mapProduct,
  mapSuggestionResults,
} from "@/lib/store-shared";
import type { BrandOption, CatalogSuggestion } from "@/lib/store-types";

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
  const bestSellerCodes =
    collection === "mas-vendidos" ? await getBestSellerCodes(PUBLIC_PAGE_SIZE * 8) : [];
  const shouldRankBestSellers = collection === "mas-vendidos" && bestSellerCodes.length > 0;
  const where = buildCatalogWhere(input, bestSellerCodes);
  const [queriedProducts, totalResults, categoryRows, brandRows, visibleCount, featuredCount, settings] =
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
      prisma.product.count({ where }),
      prisma.category.findMany({
        where: {
          products: {
            some: {
              isVisible: true,
              stockUnits: { gt: 0 },
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
        },
        distinct: ["brand"],
        orderBy: { brand: "asc" },
        select: { brand: true },
      }),
      prisma.product.count({ where: { isVisible: true, stockUnits: { gt: 0 } } }),
      prisma.product.count({
        where: { isVisible: true, isFeatured: true, stockUnits: { gt: 0 } },
      }),
      getStoreSettings(),
    ]);
  const orderedProducts =
    shouldRankBestSellers ? rankProductsByCode(queriedProducts, bestSellerCodes) : queriedProducts;
  const products = shouldRankBestSellers
    ? orderedProducts.slice((page - 1) * PUBLIC_PAGE_SIZE, page * PUBLIC_PAGE_SIZE)
    : orderedProducts;

  return {
    products: products.map(mapProduct),
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

const getBestSellerCodes = cache(async (limit: number) => {
  try {
    const client = new FacturadorClient();
    const sales = await client.getSalesProducts();
    const codes: string[] = [];
    const seen = new Set<string>();

    for (const product of sales) {
      for (const candidate of [
        product.internal_id,
        product.item_code,
        product.barcode,
        product.code,
      ]) {
        if (typeof candidate !== "string") {
          continue;
        }

        const normalized = candidate.trim();

        if (!normalized || seen.has(normalized)) {
          continue;
        }

        seen.add(normalized);
        codes.push(normalized);

        if (codes.length >= limit) {
          return codes;
        }
      }
    }

    return codes;
  } catch {
    return [] as string[];
  }
});

function buildCatalogWhere(
  input: {
    query?: string;
    category?: string;
    brand?: string;
    featuredOnly?: boolean;
  },
  bestSellerCodes: string[],
) {
  const where = buildWhere(input.query, input.category, input.brand, true, input.featuredOnly);

  if (!bestSellerCodes.length) {
    return where;
  }

  return {
    AND: [
      where,
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
        ...(product.categoryId
          ? { categoryId: product.categoryId }
          : product.category
            ? { category: product.category }
            : {}),
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
