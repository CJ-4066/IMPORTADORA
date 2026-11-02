import { prisma } from "../src/lib/prisma";
import { workerTick } from "../src/lib/rocky-ai/service";
let stopping = false;
process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });
async function main() {
  console.info("[rocky-ai] worker started; no OpenAI requests without server credentials and activation");
  while (!stopping) {
    try { await workerTick(); }
    catch {
      console.error("[rocky-ai] worker failed; pending deliveries are not retried blindly");
      await prisma.rockyAiSettings.updateMany({ where: { id: 1 }, data: { workerError: "Error del procesador. Revisa los registros del servidor." } }).catch(() => {});
    }
    if (!stopping) await new Promise(resolve => setTimeout(resolve, 5000));
  }
  await prisma.$disconnect();
}
void main().catch(() => { process.exitCode = 1; });
