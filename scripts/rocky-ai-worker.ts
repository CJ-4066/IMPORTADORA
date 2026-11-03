import { prisma } from "../src/lib/prisma";
import { RockyAiCatalogWorker } from "../src/lib/rocky-ai/catalog-worker";
import { workerTick } from "../src/lib/rocky-ai/service";
let stopping = false;
const catalogWorker = new RockyAiCatalogWorker(prisma);
process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });
async function main() {
  console.info("[rocky-ai] worker started; no OpenAI requests without server credentials and activation");
  while (!stopping) {
    try {
      await workerTick();
      // PDFs are generated only after the text acknowledgement has been
      // submitted. This worker shares the same supervised production process.
      await catalogWorker.tick();
    }
    catch {
      console.error("[rocky-ai] worker failed; pending deliveries are not retried blindly");
      await prisma.rockyAiSettings.updateMany({ where: { id: 1 }, data: { workerError: "Error del procesador. Revisa los registros del servidor." } }).catch(() => {});
    }
    if (!stopping) await new Promise(resolve => setTimeout(resolve, 5000));
  }
  await prisma.$disconnect();
}
void main().catch(() => { process.exitCode = 1; });
