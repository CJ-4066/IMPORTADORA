import { FacturadorApiError } from "../src/lib/facturador/client";
import { parseFacturadorSyncMode, syncFacturadorProducts } from "../src/lib/facturador/sync";
import { prisma } from "../src/lib/prisma";

async function main() {
  const trigger = process.env.ERP_SYNC_TRIGGER === "AUTOMATIC" ? "AUTOMATIC" : "SCRIPT";
  const syncMode = parseFacturadorSyncMode(process.env.ERP_SYNC_MODE);
  const summary = await syncFacturadorProducts({ trigger, syncMode });

  console.log(`Origen: ${summary.source}`);
  console.log(
    `Modo: ${
      syncMode === "STOCK_PRICE"
        ? "Rápida de stock/precio"
        : syncMode === "INCREMENTAL"
        ? "Incremental real"
        : syncMode === "NEW_ONLY"
          ? "Solo vincular nuevos"
          : "Sincronización completa"
    }`,
  );
  console.log(`Productos recibidos: ${summary.fetched}`);
  console.log(`Productos creados: ${summary.created}`);
  console.log(`Productos actualizados: ${summary.updated}`);
  console.log(`Productos omitidos: ${summary.skipped.length}`);

  for (const skipped of summary.skipped.slice(0, 20)) {
    console.log(`- ${skipped.externalId ?? "sin-id"}: ${skipped.reason}`);
  }

  if (summary.skipped.length > 20) {
    console.log(`... ${summary.skipped.length - 20} omitidos adicionales.`);
  }
}

main()
  .catch((error) => {
    if (error instanceof FacturadorApiError) {
      console.error(`Error API externa (${error.status}): ${error.message}`);
      process.exit(1);
    }

    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
