import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { FacturadorApiError } from "../src/lib/facturador/client";
import {
  ErpSyncAlreadyRunningError,
  syncFacturadorProducts,
  type FacturadorSyncMode,
} from "../src/lib/facturador/sync";
import { prisma } from "../src/lib/prisma";

type SchedulerConfig = {
  enabled: boolean;
  runOnStart: boolean;
  timeZone: string;
  stockEveryMinutes: number;
  stockPriceEveryMinutes: number;
  fullEveryMinutes: number;
  throttleCooldownMinutes: number;
};

type SchedulerMode = FacturadorSyncMode | null;

let schedulerConfig: SchedulerConfig | null = null;
let cooldownUntil: number | null = null;

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function getSchedulerConfig(): SchedulerConfig {
  return {
    enabled: parseBoolean(process.env.ERP_SYNC_SCHEDULER_ENABLED, true),
    runOnStart: parseBoolean(process.env.ERP_SYNC_SCHEDULER_RUN_ON_START, false),
    timeZone: process.env.ERP_SYNC_SCHEDULER_TIME_ZONE?.trim() || "America/Lima",
    stockEveryMinutes: parsePositiveInt(process.env.ERP_SYNC_STOCK_EVERY_MINUTES, 1),
    stockPriceEveryMinutes: parsePositiveInt(process.env.ERP_SYNC_PRICE_EVERY_MINUTES, 5),
    fullEveryMinutes: parsePositiveInt(process.env.ERP_SYNC_FULL_EVERY_MINUTES, 60),
    throttleCooldownMinutes: parsePositiveInt(
      process.env.ERP_SYNC_THROTTLE_COOLDOWN_MINUTES,
      10,
    ),
  };
}

function getTimePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return {
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
  };
}

function resolveDueMode(config: SchedulerConfig, date: Date): SchedulerMode {
  const { totalMinutes } = getTimePartsInTimeZone(date, config.timeZone);

  if (config.fullEveryMinutes > 0 && totalMinutes % config.fullEveryMinutes === 0) {
    return "FULL";
  }

  if (config.stockPriceEveryMinutes > 0 && totalMinutes % config.stockPriceEveryMinutes === 0) {
    return "STOCK_PRICE";
  }

  if (config.stockEveryMinutes > 0 && totalMinutes % config.stockEveryMinutes === 0) {
    return "STOCK_ONLY";
  }

  return null;
}

function getModeLabel(mode: FacturadorSyncMode) {
  if (mode === "STOCK_ONLY") {
    return "solo stock";
  }

  if (mode === "STOCK_PRICE") {
    return "stock/precio";
  }

  if (mode === "NEW_ONLY") {
    return "solo nuevos";
  }

  if (mode === "INCREMENTAL") {
    return "incremental";
  }

  return "completa";
}

function getTickDelayMs(date: Date) {
  return 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds());
}

function isThrottleError(error: unknown) {
  return (
    error instanceof FacturadorApiError &&
    error.status === 500 &&
    /ThrottleRequests/i.test(error.message)
  );
}

async function runSync(mode: FacturadorSyncMode) {
  if (!schedulerConfig) {
    throw new Error("El scheduler no fue inicializado correctamente.");
  }

  const startedAt = new Date();
  console.log(
    `[ERP scheduler] Iniciando sync ${getModeLabel(mode)} a las ${startedAt.toISOString()}`,
  );

  try {
    const summary = await syncFacturadorProducts({
      trigger: "AUTOMATIC",
      syncMode: mode,
    });

    console.log(
      `[ERP scheduler] Sync ${getModeLabel(mode)} completada. Recibidos=${summary.fetched} Creados=${summary.created} Actualizados=${summary.updated} Omitidos=${summary.skipped.length}`,
    );
  } catch (error) {
    if (error instanceof ErpSyncAlreadyRunningError) {
      console.log(`[ERP scheduler] Sync ${getModeLabel(mode)} omitida: ya había una ejecución en curso.`);
      return;
    }

    if (error instanceof FacturadorApiError) {
      if (isThrottleError(error)) {
        cooldownUntil = Date.now() + schedulerConfig.throttleCooldownMinutes * 60_000;
        console.error(
          `[ERP scheduler] Throttle detectado. Enfriando durante ${schedulerConfig.throttleCooldownMinutes} minutos.`,
        );
      }

      console.error(
        `[ERP scheduler] ERP respondió HTTP ${error.status} durante sync ${getModeLabel(mode)}:`,
        error.message,
      );
      return;
    }

    console.error(`[ERP scheduler] Error en sync ${getModeLabel(mode)}:`, error);
  }
}

async function main() {
  schedulerConfig = getSchedulerConfig();
  cooldownUntil = null;

  if (!schedulerConfig.enabled) {
    console.log("[ERP scheduler] Deshabilitado por ERP_SYNC_SCHEDULER_ENABLED=0");
    await prisma.$disconnect();
    return;
  }

  let stopped = false;
  const stop = async () => {
    if (stopped) {
      return;
    }

    stopped = true;
    console.log("[ERP scheduler] Deteniendo...");
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  if (schedulerConfig.runOnStart) {
    const initialMode = resolveDueMode(schedulerConfig, new Date());
    if (initialMode) {
      await runSync(initialMode);
    }
  }

  while (!stopped) {
    const now = new Date();
    const mode =
      cooldownUntil && Date.now() < cooldownUntil ? null : resolveDueMode(schedulerConfig, now);

    if (cooldownUntil && Date.now() < cooldownUntil) {
      const remainingMinutes = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 60_000));
      console.log(
        `[ERP scheduler] Enfriamiento activo. Próximo intento en ~${remainingMinutes} minuto(s).`,
      );
    }

    if (mode) {
      await runSync(mode);
    } else {
      console.log("[ERP scheduler] Sin modo due para este minuto; esperando siguiente tick.");
    }

    await sleep(getTickDelayMs(new Date()));
  }
}

main().catch(async (error) => {
  console.error("[ERP scheduler] Error fatal:", error);
  await prisma.$disconnect();
  process.exit(1);
});
