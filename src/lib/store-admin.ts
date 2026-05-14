import type { Prisma, QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  buildComparisonMetric,
  buildWhere,
  calculateDeltaPercent,
  hasProductPhoto,
  mapCatalogMovementProduct,
  mapCategory,
  mapErpSyncLog,
  mapProduct,
} from "@/lib/store-shared";
import type {
  AdminCategory,
  AdminQuoteDetailView,
  AdminQuotePdfNotificationView,
  AdminQuotesData,
  AdminQuoteStatusStepView,
  DashboardPeriod,
  DashboardTrendProduct,
  ErpSyncLogView,
  ShopperAccountView,
  ShopperQuoteDetailView,
  ShopperQuoteView,
} from "@/lib/store-types";

const ADMIN_QUOTES_PAGE_SIZE = 20;

function mapQuoteStatusSteps(value: Prisma.JsonValue | null): AdminQuoteStatusStepView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, Prisma.JsonValue>;
    const text = typeof record.text === "string" ? record.text.trim() : "";
    const rawStatus = typeof record.status === "string" ? record.status : "warning";

    if (!text) {
      return [];
    }

    return [
      {
        status:
          rawStatus === "success" || rawStatus === "error" || rawStatus === "warning"
            ? rawStatus
            : "warning",
        text,
      },
    ];
  });
}

function mapQuotePdfNotification(value: Prisma.JsonValue | null): AdminQuotePdfNotificationView {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, Prisma.JsonValue>;

  return {
    message:
      typeof record.message === "string" && record.message.trim()
        ? record.message.trim()
        : "Sin detalle de notificación.",
    ok: record.ok === true,
    sent: record.sent === true,
  };
}

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
    hiddenWithoutPhotoProducts,
    visibleWithoutPhotoProducts,
    productsWithoutPhoto,
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
    prisma.product.count({
      where: { imageUrl: null, media: { none: {} }, isVisible: false },
    }),
    prisma.product.count({
      where: { imageUrl: null, media: { none: {} }, isVisible: true },
    }),
    prisma.product.count({
      where: { imageUrl: null, media: { none: {} } },
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
      hiddenWithoutPhotoProducts,
      visibleWithoutPhotoProducts,
      productsWithoutPhoto,
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
  photo?: "all" | "missing" | "with-photo";
  stock?: "all" | "low";
  page?: number;
}) {
  const page = Math.max(1, input.page ?? 1);
  const baseWhere = buildWhere(input.query, input.category, input.brand, false);
  const baseConditions: Prisma.ProductWhereInput[] = [
    baseWhere,
    ...(input.visibility === "visible"
      ? [{ isVisible: true }]
      : input.visibility === "hidden"
        ? [{ isVisible: false }]
        : []),
    ...(input.stock === "low" ? [{ stockUnits: { lte: 12 } }] : []),
  ];

  const filtersWhere: Prisma.ProductWhereInput = {
    AND: baseConditions,
  };

  const [allFilteredProducts, categories, brands, statsProducts] = await prisma.$transaction([
    prisma.product.findMany({
      where: filtersWhere,
      include: {
        media: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { brand: { not: null } },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
      select: { brand: true },
    }),
    prisma.product.findMany({
      select: {
        imageUrl: true,
        isVisible: true,
        media: {
          select: { url: true },
        },
      },
    }),
  ]);

  const filteredProducts =
    input.photo === "all"
      ? allFilteredProducts
      : allFilteredProducts.filter((product) =>
          input.photo === "missing"
            ? !hasProductPhoto({ imageUrl: product.imageUrl, media: product.media })
            : hasProductPhoto({ imageUrl: product.imageUrl, media: product.media }),
        );
  const visibleProductsCount = statsProducts.filter((product) => product.isVisible).length;
  const hiddenProductsCount = statsProducts.length - visibleProductsCount;
  const productsWithoutPhotoCount = statsProducts.filter(
    (product) => !hasProductPhoto({ imageUrl: product.imageUrl, media: product.media }),
  ).length;
  const withPhotoProductsCount = statsProducts.length - productsWithoutPhotoCount;
  const pageSlice = filteredProducts.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  return {
    products: pageSlice.map(mapProduct),
    categories: categories.map(mapCategory),
    brands: brands
      .map((item) => item.brand?.trim())
      .filter((value): value is string => Boolean(value))
      .map((name) => ({ name })),
    stats: {
      totalProducts: statsProducts.length,
      withPhotoProducts: withPhotoProductsCount,
      withoutPhotoProducts: productsWithoutPhotoCount,
      visibleProducts: visibleProductsCount,
      hiddenProducts: hiddenProductsCount,
    },
    totalResults: filteredProducts.length,
    totalPages: Math.max(1, Math.ceil(filteredProducts.length / ADMIN_PAGE_SIZE)),
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

export async function getShopperQuoteHistory(
  userId: string,
  limit = 6,
): Promise<ShopperQuoteView[]> {
  const quotes = await prisma.quote.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          code: true,
          name: true,
          quantity: true,
          total: true,
        },
      },
    },
  });

  return quotes.map((quote) => ({
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    total: Number(quote.total),
    currencySymbol: quote.currencySymbol,
    createdAt: quote.createdAt.toISOString(),
    itemCount: quote.items.reduce((sum, item) => sum + item.quantity, 0),
    items: quote.items.slice(0, 3).map((item) => ({
      code: item.code,
      name: item.name,
      quantity: item.quantity,
      total: Number(item.total),
    })),
  }));
}

export async function getShopperQuoteById(
  userId: string,
  quoteId: string,
): Promise<ShopperQuoteDetailView | null> {
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      userId,
    },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          product: {
            include: {
              media: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!quote) {
    return null;
  }

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    total: Number(quote.total),
    currencySymbol: quote.currencySymbol,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    customerName: quote.customerName,
    customerPhone: quote.customerPhone,
    customerEmail: quote.customerEmail,
    customerAddress: quote.customerAddress,
    customerDocumentNumber: quote.customerDocumentNumber,
    customerDocumentType: quote.customerDocumentType,
    errorMessage: quote.errorMessage,
    itemCount: quote.items.reduce((sum, item) => sum + item.quantity, 0),
    items: quote.items.map((item) => ({
      code: item.code,
      name: item.name,
      product:
        item.product && item.product.isVisible && item.product.stockUnits > 0
          ? mapProduct(item.product)
          : null,
      quantity: item.quantity,
      tierLabel: item.tierLabel,
      total: Number(item.total),
      unitPrice: Number(item.unitPrice),
    })),
    note: quote.note,
    statusSteps: mapQuoteStatusSteps(quote.statusSteps),
    whatsappHref: quote.whatsappHref,
  };
}

export async function getAdminQuotes(input: {
  page?: number;
  status?: QuoteStatus | "all";
} = {}): Promise<AdminQuotesData> {
  const page = Math.max(1, input.page ?? 1);
  const where: Prisma.QuoteWhereInput =
    input.status && input.status !== "all" ? { status: input.status } : {};

  const [
    quotes,
    totalResults,
    totalQuotes,
    pendingQuotes,
    registeredQuotes,
    errorQuotes,
  ] = await prisma.$transaction([
    prisma.quote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: ADMIN_QUOTES_PAGE_SIZE,
      skip: (page - 1) * ADMIN_QUOTES_PAGE_SIZE,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            code: true,
            name: true,
            quantity: true,
            total: true,
          },
        },
      },
    }),
    prisma.quote.count({ where }),
    prisma.quote.count(),
    prisma.quote.count({ where: { status: "PENDING" } }),
    prisma.quote.count({ where: { status: "ERP_REGISTERED" } }),
    prisma.quote.count({ where: { status: "ERROR" } }),
  ]);

  return {
    quotes: quotes.map((quote) => ({
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      total: Number(quote.total),
      currencySymbol: quote.currencySymbol,
      customerName: quote.customerName,
      customerPhone: quote.customerPhone,
      customerEmail: quote.customerEmail,
      erpCustomerMode: quote.erpCustomerMode,
      createdAt: quote.createdAt.toISOString(),
      itemCount: quote.items.reduce((sum, item) => sum + item.quantity, 0),
      items: quote.items.slice(0, 4).map((item) => ({
        code: item.code,
        name: item.name,
        quantity: item.quantity,
        total: Number(item.total),
      })),
      user: quote.user
        ? {
            email: quote.user.email,
            name: quote.user.name,
          }
        : null,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(totalResults / ADMIN_QUOTES_PAGE_SIZE)),
    totalResults,
    stats: {
      all: totalQuotes,
      pending: pendingQuotes,
      registered: registeredQuotes,
      error: errorQuotes,
    },
  };
}

export async function getAdminQuoteById(id: string): Promise<AdminQuoteDetailView | null> {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          code: true,
          externalId: true,
          name: true,
          productId: true,
          quantity: true,
          tierLabel: true,
          total: true,
          unitPrice: true,
        },
      },
    },
  });

  if (!quote) {
    return null;
  }

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    total: Number(quote.total),
    currencySymbol: quote.currencySymbol,
    customerName: quote.customerName,
    customerPhone: quote.customerPhone,
    customerEmail: quote.customerEmail,
    customerAddress: quote.customerAddress,
    customerDocumentNumber: quote.customerDocumentNumber,
    customerDocumentType: quote.customerDocumentType,
    erpCustomerId: quote.erpCustomerId,
    erpCustomerMode: quote.erpCustomerMode,
    erpExternalId: quote.erpExternalId,
    errorMessage: quote.errorMessage,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    itemCount: quote.items.reduce((sum, item) => sum + item.quantity, 0),
    items: quote.items.map((item) => ({
      code: item.code,
      externalId: item.externalId,
      name: item.name,
      productId: item.productId,
      quantity: item.quantity,
      tierLabel: item.tierLabel,
      total: Number(item.total),
      unitPrice: Number(item.unitPrice),
    })),
    note: quote.note,
    pdfNotification: mapQuotePdfNotification(quote.pdfNotification),
    statusSteps: mapQuoteStatusSteps(quote.statusSteps),
    user: quote.user
      ? {
          email: quote.user.email,
          name: quote.user.name,
        }
      : null,
    whatsappHref: quote.whatsappHref,
  };
}
