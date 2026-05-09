import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  buildComparisonMetric,
  buildWhere,
  calculateDeltaPercent,
  mapCatalogMovementProduct,
  mapCategory,
  mapErpSyncLog,
  mapProduct,
} from "@/lib/store-shared";
import type {
  AdminCategory,
  DashboardPeriod,
  DashboardTrendProduct,
  ErpSyncLogView,
  ShopperAccountView,
} from "@/lib/store-types";

function getDashboardPeriodRange(period: DashboardPeriod, offset = 0) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "WEEK") {
    const day = now.getDay();
    const distanceFromMonday = day === 0 ? 6 : day - 1;
    start.setDate(now.getDate() - distanceFromMonday + offset * 7);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  if (period === "YEAR") {
    start.setFullYear(now.getFullYear() + offset, 0, 1);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setFullYear(start.getFullYear() + 1);
    return { start, end };
  }

  start.setFullYear(now.getFullYear(), now.getMonth() + offset, 1);
  start.setHours(0, 0, 0, 0);
  end.setTime(start.getTime());
  end.setMonth(start.getMonth() + 1);
  return { start, end };
}

function formatDashboardPeriodTitle(period: DashboardPeriod, range: { start: Date; end: Date }) {
  if (period === "WEEK") {
    const formatter = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" });
    const lastDay = new Date(range.end.getTime() - 1);
    return `${formatter.format(range.start)} - ${formatter.format(lastDay)}`;
  }

  if (period === "YEAR") {
    return new Intl.DateTimeFormat("es-PE", { year: "numeric" }).format(range.start);
  }

  return new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(
    range.start,
  );
}

export async function getRecentErpSyncLogs(limit = 8): Promise<ErpSyncLogView[]> {
  const logs = await prisma.erpSyncLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs.map(mapErpSyncLog);
}

export async function getAdminDashboardData(period: DashboardPeriod = "MONTH") {
  const currentRange = getDashboardPeriodRange(period, 0);
  const previousRange = getDashboardPeriodRange(period, -1);
  const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const [
    totalProducts,
    visibleProducts,
    hiddenProducts,
    lowStockProducts,
    outOfStockProducts,
    hiddenOutOfStockProducts,
    visibleOutOfStockProducts,
    totalCategories,
    settings,
    currentSyncAggregate,
    previousSyncAggregate,
    lastSync,
    syncedProducts,
    neverSyncedProducts,
    staleSyncedProducts,
    recentlySyncedProducts,
    lowAvailabilityProducts,
  ] = await prisma.$transaction([
    prisma.product.count(),
    prisma.product.count({ where: { isVisible: true, stockUnits: { gt: 0 } } }),
    prisma.product.count({ where: { isVisible: false } }),
    prisma.product.count({ where: { stockUnits: { gt: 0, lte: 12 } } }),
    prisma.product.count({ where: { stockUnits: { lte: 0 } } }),
    prisma.product.count({
      where: { syncEnabled: true, isVisible: false, stockUnits: { lte: 0 } },
    }),
    prisma.product.count({
      where: { syncEnabled: true, isVisible: true, stockUnits: { lte: 0 } },
    }),
    prisma.category.count(),
    prisma.storeSettings.findUnique({ where: { id: 1 } }),
    prisma.erpSyncLog.aggregate({
      where: {
        startedAt: { gte: currentRange.start, lt: currentRange.end },
        status: "SUCCESS",
      },
      _sum: {
        fetchedCount: true,
        createdCount: true,
        updatedCount: true,
        skippedCount: true,
      },
      _count: true,
    }),
    prisma.erpSyncLog.aggregate({
      where: {
        startedAt: { gte: previousRange.start, lt: previousRange.end },
        status: "SUCCESS",
      },
      _sum: {
        fetchedCount: true,
        createdCount: true,
        updatedCount: true,
        skippedCount: true,
      },
      _count: true,
    }),
    prisma.erpSyncLog.findFirst({
      orderBy: { startedAt: "desc" },
    }),
    prisma.product.count({ where: { syncEnabled: true } }),
    prisma.product.count({ where: { lastSyncedAt: null } }),
    prisma.product.count({ where: { syncEnabled: true, lastSyncedAt: { lt: staleDate } } }),
    prisma.product.findMany({
      where: { syncEnabled: true, lastSyncedAt: { not: null } },
      orderBy: [{ lastSyncedAt: "desc" }, { stockUnits: "desc" }],
      take: 4,
    }),
    prisma.product.findMany({
      where: { isVisible: true, stockUnits: { gt: 0, lte: 12 } },
      orderBy: [{ stockUnits: "asc" }, { lastSyncedAt: "asc" }],
      take: 4,
    }),
  ]);

  const currentFetched = currentSyncAggregate._sum.fetchedCount ?? 0;
  const previousFetched =
    previousSyncAggregate._count > 0 ? previousSyncAggregate._sum.fetchedCount ?? 0 : null;
  const currentTouched =
    (currentSyncAggregate._sum.createdCount ?? 0) +
    (currentSyncAggregate._sum.updatedCount ?? 0);
  const previousTouched =
    previousSyncAggregate._count > 0
      ? (previousSyncAggregate._sum.createdCount ?? 0) +
        (previousSyncAggregate._sum.updatedCount ?? 0)
      : null;
  const currentSkipped = currentSyncAggregate._sum.skippedCount ?? 0;
  const previousSkipped =
    previousSyncAggregate._count > 0 ? previousSyncAggregate._sum.skippedCount ?? 0 : null;
  const risingProducts: DashboardTrendProduct[] = recentlySyncedProducts.map((product) =>
    mapCatalogMovementProduct(product, "RISING", new Date()),
  );
  const fallingProducts: DashboardTrendProduct[] = lowAvailabilityProducts.map((product) =>
    mapCatalogMovementProduct(product, "FALLING", new Date()),
  );
  const trendProducts = [...risingProducts, ...fallingProducts];
  const maxUnitsSold = trendProducts.length
    ? Math.max(...trendProducts.map((product) => product.unitsSold))
    : 1;
  const successfulSyncs = currentSyncAggregate._count;

  return {
    totalProducts,
    visibleProducts,
    hiddenProducts,
    lowStockProducts,
    outOfStockProducts,
    totalCategories,
    currencySymbol: settings?.currencySymbol ?? "S/",
    selectedPeriod: period,
    dataFreshness: {
      sourceLabel: lastSync?.source ?? "ERP",
      lastSyncAt: lastSync?.startedAt.toISOString() ?? null,
      lastSyncStatus: lastSync?.status ?? null,
      syncedProducts,
      neverSyncedProducts,
      staleSyncedProducts,
      outOfStockProducts,
      hiddenOutOfStockProducts,
      visibleOutOfStockProducts,
    },
    trendAnalysis: {
      title: formatDashboardPeriodTitle(period, currentRange),
      previousTitle:
        previousSyncAggregate._count > 0
          ? formatDashboardPeriodTitle(period, previousRange)
          : null,
      forecast: {
        currentValue: syncedProducts,
        previousValue: totalProducts,
        deltaPercent: calculateDeltaPercent(syncedProducts, totalProducts || null),
        gap: totalProducts - syncedProducts,
        completionRate:
          totalProducts > 0 ? Math.min(100, (syncedProducts / totalProducts) * 100) : null,
      },
      comparisonMetrics: [
        buildComparisonMetric("Traídos del ERP", currentFetched, previousFetched),
        buildComparisonMetric("Creados/actualizados", currentTouched, previousTouched),
        buildComparisonMetric(
          "Sincronizaciones OK",
          successfulSyncs,
          previousSyncAggregate._count || null,
        ),
        buildComparisonMetric("Omitidos", currentSkipped, previousSkipped),
      ],
      topRisingProducts: risingProducts,
      topFallingProducts: fallingProducts,
      maxUnitsSold,
    },
  };
}

export async function getAdminProducts(input: {
  query?: string;
  category?: string;
  brand?: string;
  visibility?: "all" | "visible" | "hidden";
  stock?: "all" | "low";
  page?: number;
}) {
  const page = Math.max(1, input.page ?? 1);
  const where: Prisma.ProductWhereInput = {
    ...buildWhere(input.query, input.category, input.brand, false),
    ...(input.visibility === "visible"
      ? { isVisible: true }
      : input.visibility === "hidden"
        ? { isVisible: false }
        : {}),
    ...(input.stock === "low" ? { stockUnits: { lte: 12 } } : {}),
  };

  const [products, totalResults, categories, brands] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: {
        media: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      take: ADMIN_PAGE_SIZE,
      skip: (page - 1) * ADMIN_PAGE_SIZE,
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { brand: { not: null } },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
      select: { brand: true },
    }),
  ]);

  return {
    products: products.map(mapProduct),
    categories: categories.map(mapCategory),
    brands: brands
      .map((item) => item.brand?.trim())
      .filter((value): value is string => Boolean(value))
      .map((name) => ({ name })),
    totalResults,
    totalPages: Math.max(1, Math.ceil(totalResults / ADMIN_PAGE_SIZE)),
    page,
  };
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      media: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return product ? mapProduct(product) : null;
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    productCount: category._count.products,
  }));
}

export async function getShopperAccount(userId: string): Promise<ShopperAccountView | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      role: true,
    },
  });

  if (!user || user.role !== "USERSHOP") {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt.toISOString(),
  };
}
