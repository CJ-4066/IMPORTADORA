import { Prisma, type ErpSyncTrigger } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import {
  FacturadorClient,
  FacturadorPageFetchError,
} from "@/lib/facturador/client";
import {
  buildBrandLookup,
  buildCategoryLookup,
  mapFacturadorProduct,
} from "@/lib/facturador/mappers";
import type {
  FacturadorBrand,
  FacturadorCategory,
  SyncableProduct,
} from "@/lib/facturador/types";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

const WRITE_BATCH_SIZE = 500;

export type FacturadorSyncMode = "FULL" | "STOCK_PRICE" | "NEW_ONLY" | "INCREMENTAL";

export type FacturadorSyncSummary = {
  source: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: Array<{
    externalId: string | null;
    reason: string;
  }>;
};

export type FacturadorSyncOptions = {
  client?: FacturadorClient;
  trigger?: ErpSyncTrigger;
  initiatedByName?: string | null;
  initiatedByEmail?: string | null;
  syncMode?: FacturadorSyncMode;
};

export class ErpSyncCancelledError extends Error {
  constructor(message = "La sincronización fue cancelada desde el panel.") {
    super(message);
    this.name = "ErpSyncCancelledError";
  }
}

export class ErpSyncAlreadyRunningError extends Error {
  constructor(message = "Ya hay una sincronización ERP en ejecución.") {
    super(message);
    this.name = "ErpSyncAlreadyRunningError";
  }
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No se pudo completar la sincronización con el ERP.";
}

function buildExternalKey(source: string, externalId: string) {
  return `${source}::${externalId}`;
}

export function parseFacturadorSyncMode(value: string | null | undefined): FacturadorSyncMode {
  const normalized = value?.trim().toUpperCase().replace(/-/g, "_") ?? "";

  if (normalized === "STOCK_PRICE" || normalized === "FAST" || normalized === "QUICK") {
    return "STOCK_PRICE";
  }

  if (normalized === "INCREMENTAL") {
    return "INCREMENTAL";
  }

  if (normalized === "NEW_ONLY") {
    return "NEW_ONLY";
  }

  return "FULL";
}

function getExistingProductSnapshot(
  product: Pick<PreparedSyncableProduct, "code" | "externalSource" | "externalId">,
  existingByCode: Map<string, ExistingProductSnapshot>,
  existingByExternal: Map<string, ExistingProductSnapshot>,
) {
  return (
    existingByExternal.get(buildExternalKey(product.externalSource, product.externalId)) ??
    existingByCode.get(product.code) ??
    null
  );
}

function buildProductSyncHash(
  product: Pick<
    SyncableProduct,
    | "code"
    | "slug"
    | "name"
    | "description"
    | "brand"
    | "category"
    | "categoryId"
    | "imageUrl"
    | "unitLabel"
    | "unitPrice"
    | "wholesalePrice"
    | "wholesaleMinQty"
    | "boxPrice"
    | "unitsPerBox"
    | "stockUnits"
    | "isVisible"
    | "isFeatured"
    | "externalSource"
    | "externalId"
    | "externalCode"
    | "syncEnabled"
  >,
) {
  const payload = {
    boxPrice: product.boxPrice ?? null,
    brand: product.brand ?? null,
    category: product.category ?? null,
    categoryId: product.categoryId ?? null,
    code: product.code,
    description: product.description ?? null,
    externalCode: product.externalCode ?? null,
    externalId: product.externalId,
    externalSource: product.externalSource,
    imageUrl: product.imageUrl ?? null,
    isFeatured: product.isFeatured,
    isVisible: product.isVisible,
    name: product.name,
    slug: product.slug,
    stockUnits: product.stockUnits,
    syncEnabled: product.syncEnabled,
    unitLabel: product.unitLabel,
    unitPrice: product.unitPrice,
    unitsPerBox: product.unitsPerBox ?? null,
    wholesaleMinQty: product.wholesaleMinQty,
    wholesalePrice: product.wholesalePrice ?? null,
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function buildProductQuickSyncHash(
  product: Pick<
    SyncableProduct,
    | "code"
    | "externalSource"
    | "externalId"
    | "externalCode"
    | "stockUnits"
    | "unitPrice"
    | "wholesalePrice"
    | "wholesaleMinQty"
    | "boxPrice"
    | "unitsPerBox"
    | "isVisible"
    | "syncEnabled"
  >,
) {
  const payload = {
    boxPrice: product.boxPrice ?? null,
    code: product.code,
    externalCode: product.externalCode ?? null,
    externalId: product.externalId,
    externalSource: product.externalSource,
    isVisible: product.isVisible,
    stockUnits: product.stockUnits,
    syncEnabled: product.syncEnabled,
    unitPrice: product.unitPrice,
    unitsPerBox: product.unitsPerBox ?? null,
    wholesaleMinQty: product.wholesaleMinQty,
    wholesalePrice: product.wholesalePrice ?? null,
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function ensureSyncNotCancelled(syncLogId: string) {
  const log = await prisma.erpSyncLog.findUnique({
    where: { id: syncLogId },
    select: { status: true, cancelRequestedAt: true },
  });

  if (!log) {
    throw new ErpSyncCancelledError("La bitácora de sincronización ya no existe.");
  }

  if (log.status === "CANCELED" || log.cancelRequestedAt) {
    throw new ErpSyncCancelledError();
  }
}

async function prepareSyncSlot(client: FacturadorClient) {
  const staleStartedBefore = new Date(Date.now() - client.runningSyncTimeoutMs);

  await prisma.erpSyncLog.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: staleStartedBefore },
    },
    data: {
      status: "ERROR",
      errorMessage: "Sincronización cerrada automáticamente por exceder el tiempo máximo.",
      finishedAt: new Date(),
    },
  });

  const runningSync = await prisma.erpSyncLog.findFirst({
    where: { status: "RUNNING" },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  });

  if (runningSync) {
    throw new ErpSyncAlreadyRunningError(
      `Ya hay una sincronización ERP en ejecución desde ${runningSync.startedAt.toISOString()}.`,
    );
  }
}

async function loadIncrementalCheckpoint(source: string) {
  const lastSuccessfulSync = await prisma.erpSyncLog.findFirst({
    where: {
      source,
      status: "SUCCESS",
      finishedAt: { not: null },
    },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
  });

  return lastSuccessfulSync?.finishedAt ?? null;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

type PreparedSyncableProduct = SyncableProduct & {
  categoryName: string | null;
};

type WriteAction = "created" | "updated";

type PreparedWritableProduct = SyncableProduct & {
  categoryId: string | null;
  syncHash: string | null;
  syncQuickHash: string | null;
  writeAction: WriteAction;
};

type ExistingProductSnapshot = {
  id: string;
  syncHash: string | null;
  syncQuickHash: string | null;
};

type ChunkUpsertResult = {
  created: number;
  updated: number;
  skipped: Array<{
    externalId: string | null;
    reason: string;
  }>;
};

async function updateSyncProgress(
  syncLogId: string,
  data: Partial<{
    fetchedCount: number;
    progressTotalCount: number;
    processedCount: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errorCount: number;
  }>,
) {
  await prisma.erpSyncLog.updateMany({
    where: { id: syncLogId, status: "RUNNING" },
    data,
  });
}

async function resolveCategoryIds(products: PreparedSyncableProduct[]) {
  const names = Array.from(
    new Set(
      products
        .map((product) => product.categoryName?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (!names.length) {
    return new Map<string, string>();
  }

  await prisma.category.createMany({
    data: names.map((name) => ({
      name,
      slug: slugify(name),
    })),
    skipDuplicates: true,
  });

  const categories = await prisma.category.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true },
  });

  return new Map(categories.map((category) => [category.name, category.id]));
}

async function loadExistingProductMap(products: PreparedSyncableProduct[]) {
  if (!products.length) {
    return {
      existingByCode: new Map<string, ExistingProductSnapshot>(),
      existingByExternal: new Map<string, ExistingProductSnapshot>(),
    };
  }

  const codes = Array.from(new Set(products.map((product) => product.code)));
  const externalIds = Array.from(
    new Set(
      products
        .map((product) => product.externalId?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const conditions: Prisma.ProductWhereInput[] = [];

  if (codes.length) {
    conditions.push({ code: { in: codes } });
  }

  if (externalIds.length) {
    conditions.push({
      externalSource: products[0].externalSource,
      externalId: { in: externalIds },
    });
  }

  const existingProducts = await prisma.product.findMany({
    where: conditions.length ? { OR: conditions } : undefined,
    select: {
      id: true,
      code: true,
      externalSource: true,
      externalId: true,
      syncHash: true,
      syncQuickHash: true,
    },
  });

  const existingByCode = new Map<string, ExistingProductSnapshot>();
  const existingByExternal = new Map<string, ExistingProductSnapshot>();

  for (const product of existingProducts) {
    const snapshot = {
      id: product.id,
      syncHash: product.syncHash,
      syncQuickHash: product.syncQuickHash,
    };
    existingByCode.set(product.code, snapshot);

    if (product.externalSource && product.externalId) {
      existingByExternal.set(
        buildExternalKey(product.externalSource, product.externalId),
        snapshot,
      );
    }
  }

  return {
    existingByCode,
    existingByExternal,
  };
}

export async function syncFacturadorProducts(options: FacturadorSyncOptions = {}) {
  const client = options.client ?? new FacturadorClient();
  const syncMode = options.syncMode ?? "FULL";
  const isQuickMode = syncMode === "STOCK_PRICE";
  const isNewOnlyMode = syncMode === "NEW_ONLY";
  const isIncrementalMode = syncMode === "INCREMENTAL";
  await prepareSyncSlot(client);
  const syncedAt = new Date();
  const syncLog = await prisma.erpSyncLog.create({
    data: {
      source: client.source,
      trigger: options.trigger ?? "SCRIPT",
      syncMode,
      status: "RUNNING",
      fetchedCount: 0,
      progressTotalCount: 0,
      processedCount: 0,
      errorCount: 0,
      initiatedByName: options.initiatedByName ?? null,
      initiatedByEmail: options.initiatedByEmail ?? null,
      startedAt: syncedAt,
    },
    select: { id: true },
  });

  try {
    await ensureSyncNotCancelled(syncLog.id);

    const incrementalCheckpoint =
      isIncrementalMode && client.supportsIncrementalProductSync()
        ? await loadIncrementalCheckpoint(client.source)
        : null;

    if (isIncrementalMode && !client.supportsIncrementalProductSync()) {
      throw new Error(
        "El modo incremental real requiere FACTURADOR_SYNC_UPDATED_SINCE_PARAM para filtrar solo cambios del ERP.",
      );
    }

    const [categories, brands, products] = await Promise.all([
      isQuickMode ? Promise.resolve([] as FacturadorCategory[]) : client.getCategories(),
      isQuickMode ? Promise.resolve([] as FacturadorBrand[]) : client.getBrands(),
      client.getProducts(
        isIncrementalMode && incrementalCheckpoint
          ? { updatedSince: incrementalCheckpoint }
          : {},
      ),
    ]);
    const categoryLookup = buildCategoryLookup(categories);
    const brandLookup = buildBrandLookup(brands);
  const summary: FacturadorSyncSummary = {
    source: client.source,
    fetched: products.length,
    created: 0,
    updated: 0,
    skipped: [],
  };
  let processedCount = 0;
  let errorCount = 0;
  const preparedProducts: PreparedSyncableProduct[] = [];
    const seenExternalKeys = new Set<string>();
    const seenCodes = new Set<string>();
    const syncedExternalIds = new Set<string>();

    for (const item of products) {
      const mapped = mapFacturadorProduct(
        item,
        {
          categories: categoryLookup,
          brands: brandLookup,
        },
        client.source,
        syncedAt,
      );

      if (!mapped.ok) {
        summary.skipped.push({
          externalId: mapped.externalId,
          reason: mapped.reason,
        });
        continue;
      }

      const externalKey = buildExternalKey(
        mapped.product.externalSource,
        mapped.product.externalId,
      );

      if (seenExternalKeys.has(externalKey) || seenCodes.has(mapped.product.code)) {
        summary.skipped.push({
          externalId: mapped.product.externalId,
          reason: "Producto duplicado dentro del mismo lote de sincronización.",
        });
        continue;
      }

      seenExternalKeys.add(externalKey);
      seenCodes.add(mapped.product.code);
      syncedExternalIds.add(mapped.product.externalId);

      preparedProducts.push({
        ...mapped.product,
        categoryName: mapped.categoryName,
      });
    }

    await ensureSyncNotCancelled(syncLog.id);
    const { existingByCode, existingByExternal } = await loadExistingProductMap(preparedProducts);
    await updateSyncProgress(syncLog.id, {
      fetchedCount: summary.fetched,
      progressTotalCount: preparedProducts.length,
      processedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: summary.skipped.length,
      errorCount: 0,
    });
    let productsToWrite = preparedProducts;

    if (isQuickMode) {
      productsToWrite = preparedProducts.filter((product) => {
        const existingSnapshot = getExistingProductSnapshot(
          product,
          existingByCode,
          existingByExternal,
        );

        if (!existingSnapshot) {
          summary.skipped.push({
            externalId: product.externalId,
            reason: "Producto no existe localmente; omitido en sincronización rápida.",
          });
          return false;
        }

        return true;
      });
    } else if (isNewOnlyMode) {
      productsToWrite = preparedProducts.filter((product) => {
        const existingSnapshot = getExistingProductSnapshot(
          product,
          existingByCode,
          existingByExternal,
        );

        if (existingSnapshot) {
          summary.skipped.push({
            externalId: product.externalId,
            reason: "Producto ya vinculado. Omitido en modo solo nuevos.",
          });
          return false;
        }

        return true;
      });
    }

    const categoryIdsByName = isQuickMode
      ? new Map<string, string>()
      : await resolveCategoryIds(productsToWrite);

    const writeChunks = chunkArray(productsToWrite, WRITE_BATCH_SIZE);

    for (const chunk of writeChunks) {
      await ensureSyncNotCancelled(syncLog.id);

      const resolvedProducts = chunk.flatMap((product) => {
        const categoryId = product.categoryName
          ? categoryIdsByName.get(product.categoryName) ?? null
          : null;
        const existingSnapshot =
          existingByExternal.get(
            buildExternalKey(product.externalSource, product.externalId),
          ) ?? existingByCode.get(product.code);

        if (!existingSnapshot && isQuickMode) {
          summary.skipped.push({
            externalId: product.externalId,
            reason: "Producto no existe localmente; omitido en sincronización rápida.",
          });
          return [];
        }

        if (isQuickMode) {
          const syncQuickHash = buildProductQuickSyncHash(product);

          if (existingSnapshot && existingSnapshot.syncQuickHash === syncQuickHash) {
            summary.skipped.push({
              externalId: product.externalId,
              reason: "Sin cambios de stock/precio respecto al último sync rápido.",
            });
            return [];
          }

          return {
            ...product,
            categoryId,
            syncHash: null,
            syncQuickHash,
            writeAction: "updated" as const,
          };
        }

        const syncHash = buildProductSyncHash({
          ...product,
          categoryId,
        });
        const syncQuickHash = buildProductQuickSyncHash(product);

        if (existingSnapshot && existingSnapshot.syncHash === syncHash) {
          summary.skipped.push({
            externalId: product.externalId,
            reason: "Sin cambios reales respecto al último sync.",
          });
          return [];
        }

        const writeAction: WriteAction = existingSnapshot ? "updated" : "created";

        return {
          ...product,
          categoryId,
          syncHash,
          syncQuickHash,
          writeAction,
        };
      });

      const result = await upsertProductChunk(resolvedProducts, syncMode);
      summary.created += result.created;
      summary.updated += result.updated;
      summary.skipped.push(...result.skipped);
      processedCount += chunk.length;
      errorCount += result.skipped.length;

      await updateSyncProgress(syncLog.id, {
        processedCount,
        createdCount: summary.created,
        updatedCount: summary.updated,
        skippedCount: summary.skipped.length,
        errorCount,
      });
    }

    if (
      syncMode === "FULL" &&
      client.isFullProductSync() &&
      client.shouldHideMissingProducts() &&
      syncedExternalIds.size > 0
    ) {
      await prisma.product.updateMany({
        where: {
          syncEnabled: true,
          externalSource: client.source,
          externalId: { notIn: Array.from(syncedExternalIds) },
        },
        data: {
          isVisible: false,
          stockUnits: 0,
        },
      });
    }

    const completed = await prisma.erpSyncLog.updateMany({
      where: {
        id: syncLog.id,
        status: "RUNNING",
        cancelRequestedAt: null,
      },
      data: {
        status: "SUCCESS",
        fetchedCount: summary.fetched,
        createdCount: summary.created,
        updatedCount: summary.updated,
        skippedCount: summary.skipped.length,
        skippedPreview: summary.skipped.slice(0, 15) as Prisma.JsonArray,
        finishedAt: new Date(),
      },
    });

    if (completed.count === 0) {
      throw new ErpSyncCancelledError();
    }

    return summary;
  } catch (error) {
    if (error instanceof ErpSyncCancelledError) {
      await prisma.erpSyncLog.updateMany({
        where: { id: syncLog.id, status: "RUNNING" },
        data: {
          status: "CANCELED",
          errorMessage: error.message,
          finishedAt: new Date(),
        },
      });

      throw error;
    }

    const pageError =
      error instanceof FacturadorPageFetchError
        ? error
        : error instanceof Error
          ? null
          : null;

    await prisma.erpSyncLog.updateMany({
      where: { id: syncLog.id, status: "RUNNING" },
      data: {
        status: "ERROR",
        errorMessage: normalizeErrorMessage(error),
        failedPage: pageError?.page ?? null,
        failedPageMessage: pageError?.message ?? null,
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}

async function upsertProductChunk(
  products: Array<PreparedWritableProduct>,
  syncMode: FacturadorSyncMode,
): Promise<ChunkUpsertResult> {
  if (!products.length) {
    return {
      created: 0,
      updated: 0,
      skipped: [],
    };
  }

  const rows = products.map((product) => buildProductRow(product));
  const isQuickMode = syncMode === "STOCK_PRICE";

  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Product" (
        "id",
        "code",
        "slug",
        "name",
        "description",
        "brand",
        "category",
        "categoryId",
        "imageUrl",
        "unitLabel",
        "unitPrice",
        "wholesalePrice",
        "wholesaleMinQty",
        "boxPrice",
        "unitsPerBox",
        "stockUnits",
        "isVisible",
        "isFeatured",
        "createdAt",
        "updatedAt",
        "externalSource",
        "externalId",
        "externalCode",
        "syncEnabled",
        "lastSyncedAt",
        "syncHash",
        "syncQuickHash"
      )
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("code") DO UPDATE
      SET
        ${isQuickMode
          ? Prisma.sql`
              "unitPrice" = EXCLUDED."unitPrice",
              "wholesalePrice" = EXCLUDED."wholesalePrice",
              "wholesaleMinQty" = EXCLUDED."wholesaleMinQty",
              "boxPrice" = EXCLUDED."boxPrice",
              "unitsPerBox" = EXCLUDED."unitsPerBox",
              "stockUnits" = EXCLUDED."stockUnits",
              "isVisible" = EXCLUDED."isVisible",
              "syncEnabled" = EXCLUDED."syncEnabled",
              "lastSyncedAt" = EXCLUDED."lastSyncedAt",
              "syncQuickHash" = EXCLUDED."syncQuickHash",
              "updatedAt" = CURRENT_TIMESTAMP
            `
          : Prisma.sql`
              "slug" = EXCLUDED."slug",
              "name" = EXCLUDED."name",
              "description" = EXCLUDED."description",
              "brand" = EXCLUDED."brand",
              "category" = EXCLUDED."category",
              "categoryId" = EXCLUDED."categoryId",
              "imageUrl" = EXCLUDED."imageUrl",
              "unitLabel" = EXCLUDED."unitLabel",
              "unitPrice" = EXCLUDED."unitPrice",
              "wholesalePrice" = EXCLUDED."wholesalePrice",
              "wholesaleMinQty" = EXCLUDED."wholesaleMinQty",
              "boxPrice" = EXCLUDED."boxPrice",
              "unitsPerBox" = EXCLUDED."unitsPerBox",
              "stockUnits" = EXCLUDED."stockUnits",
              "isVisible" = EXCLUDED."isVisible",
              "isFeatured" = EXCLUDED."isFeatured",
              "externalSource" = EXCLUDED."externalSource",
              "externalId" = EXCLUDED."externalId",
              "externalCode" = EXCLUDED."externalCode",
              "syncEnabled" = EXCLUDED."syncEnabled",
              "lastSyncedAt" = EXCLUDED."lastSyncedAt",
              "syncHash" = EXCLUDED."syncHash",
              "syncQuickHash" = EXCLUDED."syncQuickHash",
              "updatedAt" = CURRENT_TIMESTAMP
            `}
    `);

    return {
      created: products.filter((product) => product.writeAction === "created").length,
      updated: products.filter((product) => product.writeAction === "updated").length,
      skipped: [],
    };
  } catch (error) {
    const skipped: ChunkUpsertResult["skipped"] = [];
    let created = 0;
    let updated = 0;

    for (const product of products) {
      try {
        const createData = buildPrismaProductCreateData(product);
        const updateData = buildPrismaProductUpdateData(product, syncMode);
        await prisma.product.upsert({
          where: { code: product.code },
          create: createData,
          update: updateData,
        });

        if (product.writeAction === "created") {
          created += 1;
        } else {
          updated += 1;
        }
      } catch (itemError) {
        skipped.push({
          externalId: product.externalId,
          reason: normalizeErrorMessage(itemError ?? error),
        });
      }
    }

    return { created, updated, skipped };
  }
}

function buildProductRow(
  product: PreparedWritableProduct,
) {
  return Prisma.sql`(
    ${randomUUID()},
    ${product.code},
    ${product.slug},
    ${product.name},
    ${product.description},
    ${product.brand},
    ${product.category},
    ${product.categoryId},
    ${product.imageUrl},
    ${product.unitLabel},
    ${product.unitPrice},
    ${product.wholesalePrice},
    ${product.wholesaleMinQty},
    ${product.boxPrice},
    ${product.unitsPerBox},
    ${product.stockUnits},
    ${product.isVisible},
    ${product.isFeatured},
    ${product.lastSyncedAt},
    ${product.lastSyncedAt},
    ${product.externalSource},
    ${product.externalId},
    ${product.externalCode},
    ${product.syncEnabled},
    ${product.lastSyncedAt},
    ${product.syncHash},
    ${product.syncQuickHash}
  )`;
}

function buildPrismaProductCreateData(product: PreparedWritableProduct) {
  return {
    code: product.code,
    slug: product.slug,
    name: product.name,
    description: product.description,
    brand: product.brand,
    category: product.category,
    categoryId: product.categoryId,
    imageUrl: product.imageUrl,
    unitLabel: product.unitLabel,
    unitPrice: new Prisma.Decimal(product.unitPrice),
    wholesalePrice: product.wholesalePrice === null ? null : new Prisma.Decimal(product.wholesalePrice),
    wholesaleMinQty: product.wholesaleMinQty,
    boxPrice: product.boxPrice === null ? null : new Prisma.Decimal(product.boxPrice),
    unitsPerBox: product.unitsPerBox,
    stockUnits: product.stockUnits,
    isVisible: product.isVisible,
    isFeatured: product.isFeatured,
    externalSource: product.externalSource,
    externalId: product.externalId,
    externalCode: product.externalCode,
    syncEnabled: product.syncEnabled,
    lastSyncedAt: product.lastSyncedAt,
    syncHash: product.syncHash,
    syncQuickHash: product.syncQuickHash,
  };
}

function buildPrismaProductUpdateData(
  product: PreparedWritableProduct,
  syncMode: FacturadorSyncMode,
) {
  if (syncMode === "STOCK_PRICE") {
    return {
      unitPrice: new Prisma.Decimal(product.unitPrice),
      wholesalePrice:
        product.wholesalePrice === null ? null : new Prisma.Decimal(product.wholesalePrice),
      wholesaleMinQty: product.wholesaleMinQty,
      boxPrice: product.boxPrice === null ? null : new Prisma.Decimal(product.boxPrice),
      unitsPerBox: product.unitsPerBox,
      stockUnits: product.stockUnits,
      isVisible: product.isVisible,
      syncEnabled: product.syncEnabled,
      lastSyncedAt: product.lastSyncedAt,
      syncQuickHash: product.syncQuickHash,
    };
  }

  return buildPrismaProductCreateData(product);
}
