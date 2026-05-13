import { Prisma, type ErpSyncTrigger } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { FacturadorClient } from "@/lib/facturador/client";
import {
  buildBrandLookup,
  buildCategoryLookup,
  mapFacturadorProduct,
} from "@/lib/facturador/mappers";
import type { SyncableProduct } from "@/lib/facturador/types";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

const WRITE_BATCH_SIZE = 250;

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
      existingByCode: new Map<string, string>(),
      existingByExternal: new Map<string, string>(),
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
    },
  });

  const existingByCode = new Map<string, string>();
  const existingByExternal = new Map<string, string>();

  for (const product of existingProducts) {
    existingByCode.set(product.code, product.id);

    if (product.externalSource && product.externalId) {
      existingByExternal.set(
        buildExternalKey(product.externalSource, product.externalId),
        product.id,
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
  await prepareSyncSlot(client);
  const syncedAt = new Date();
  const syncLog = await prisma.erpSyncLog.create({
    data: {
      source: client.source,
      trigger: options.trigger ?? "SCRIPT",
      status: "RUNNING",
      initiatedByName: options.initiatedByName ?? null,
      initiatedByEmail: options.initiatedByEmail ?? null,
      startedAt: syncedAt,
    },
    select: { id: true },
  });

  try {
    await ensureSyncNotCancelled(syncLog.id);

    const [categories, brands, products] = await Promise.all([
      client.getCategories(),
      client.getBrands(),
      client.getProducts(),
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
    const categoryIdsByName = await resolveCategoryIds(preparedProducts);
    const { existingByCode, existingByExternal } = await loadExistingProductMap(preparedProducts);

    const writeChunks = chunkArray(preparedProducts, WRITE_BATCH_SIZE);

    for (const chunk of writeChunks) {
      await ensureSyncNotCancelled(syncLog.id);

      const resolvedProducts = chunk.map((product) => {
        const categoryId = product.categoryName
          ? categoryIdsByName.get(product.categoryName) ?? null
          : null;

        return {
          ...product,
          categoryId,
        };
      });

      for (const product of resolvedProducts) {
        const existingId =
          existingByExternal.get(
            buildExternalKey(product.externalSource, product.externalId),
          ) ?? existingByCode.get(product.code);

        if (existingId) {
          summary.updated += 1;
        } else {
          summary.created += 1;
        }
      }

      await upsertProductChunk(resolvedProducts);
    }

    if (
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

    await prisma.erpSyncLog.updateMany({
      where: { id: syncLog.id, status: "RUNNING" },
      data: {
        status: "ERROR",
        errorMessage: normalizeErrorMessage(error),
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}

async function upsertProductChunk(
  products: Array<
    SyncableProduct & {
      categoryId: string | null;
    }
  >,
) {
  if (!products.length) {
    return;
  }

  const rows = products.map((product) => buildProductRow(product));

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
      "lastSyncedAt"
    )
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("code") DO UPDATE
    SET
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
      "updatedAt" = CURRENT_TIMESTAMP
  `);
}

function buildProductRow(
  product: SyncableProduct & {
    categoryId: string | null;
  },
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
    ${product.lastSyncedAt}
  )`;
}
