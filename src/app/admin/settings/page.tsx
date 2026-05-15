import {
  cancelErpSyncAction,
  syncProductsFromErpAction,
  updateSettingsAction,
} from "@/app/admin/actions";
import { HeroSlidesManager } from "@/components/admin/hero-slides-manager";
import { SyncDuration } from "@/components/admin/sync-duration";
import { getRecentErpSyncLogs, getStoreSettings, type ErpSyncLogView } from "@/lib/store";
import { SubmitButton } from "@/components/ui/submit-button";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  dateStyle: "medium",
  timeStyle: "short",
});

function getTriggerLabel(trigger: ErpSyncLogView["trigger"]) {
  switch (trigger) {
    case "MANUAL":
      return "Manual";
    case "AUTOMATIC":
      return "Automática";
    default:
      return "Script";
  }
}

function getStatusLabel(status: ErpSyncLogView["status"]) {
  switch (status) {
    case "SUCCESS":
      return "Correcta";
    case "ERROR":
      return "Con error";
    case "CANCELED":
      return "Cancelada";
    default:
      return "En proceso";
  }
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const [settings, syncLogs] = await Promise.all([getStoreSettings(), getRecentErpSyncLogs()]);
  const params = searchParams ? await searchParams : undefined;
  const status = typeof params?.status === "string" ? params.status : "";
  const error = typeof params?.error === "string" ? params.error : "";
  const syncStatus = typeof params?.syncStatus === "string" ? params.syncStatus : "";
  const syncError = typeof params?.syncError === "string" ? params.syncError : "";
  const syncMode = typeof params?.syncMode === "string" ? params.syncMode : "";
  const fetched = Number(typeof params?.fetched === "string" ? params.fetched : "0");
  const created = Number(typeof params?.created === "string" ? params.created : "0");
  const updated = Number(typeof params?.updated === "string" ? params.updated : "0");
  const skipped = Number(typeof params?.skipped === "string" ? params.skipped : "0");
  const syncModeLabel =
    syncMode === "NEW_ONLY" ? "solo vincular nuevos" : "sincronización completa";
  const successfulDurations = syncLogs
    .filter((log) => log.status === "SUCCESS" && log.durationMs !== null)
    .map((log) => log.durationMs as number);
  const averageDurationMs = successfulDurations.length
    ? Math.round(successfulDurations.reduce((total, value) => total + value, 0) / successfulDurations.length)
    : null;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Configuración</p>
          <h1>Datos globales del catálogo</h1>
        </div>
        <p className="panel-copy">
          Aquí centralizas el número de WhatsApp, textos del hero y colores base de la interfaz.
        </p>
      </div>

      {status ? <p className="success-text">Configuración actualizada.</p> : null}
      {error ? <p className="error-text auth-error">{error}</p> : null}
      {syncStatus === "success" ? (
        <p className="success-text">
          Sincronización completada ({syncModeLabel}). Recibidos: {fetched} · creados: {created} ·
          actualizados: {updated} · omitidos: {skipped}
        </p>
      ) : null}
      {syncStatus === "error" ? <p className="error-text auth-error">{syncError}</p> : null}
      {syncStatus === "cancelled" ? (
        <p className="success-text">La sincronización fue cancelada desde el panel.</p>
      ) : null}

      <section className="panel sync-panel" id="erp-sync">
        <div className="panel-header">
          <div>
            <p className="eyebrow">ERP</p>
            <h2>Sincronización de productos</h2>
          </div>
          <p className="panel-copy">
            El flujo actual sincroniza desde el ERP hacia la tienda. Para que ocurra cada 60 minutos, prográmalo en el VPS con `npm run sync:facturador-products`.
          </p>
        </div>

        <div className="sync-panel-grid">
          <article className="sync-note-card">
            <strong>Manual desde admin</strong>
            <p className="muted">
              Ejecuta la sincronización cuando necesites traer productos nuevos, stock o cambios hechos en el ERP.
            </p>
            <form action={syncProductsFromErpAction} className="sync-action-form">
              <label className="field sync-mode-field">
                <span>Modo de sincronización</span>
                <select defaultValue="FULL" name="syncMode">
                  <option value="FULL">Sincronización completa</option>
                  <option value="NEW_ONLY">Solo vincular nuevos</option>
                </select>
              </label>
              <SubmitButton pendingLabel="Sincronizando...">Sincronizar desde ERP</SubmitButton>
            </form>
          </article>

          <article className="sync-note-card">
            <strong>Automática cada 60 minutos</strong>
            <p className="muted">
              Recomendado en el VPS con `cron`. Ejemplo:
            </p>
            <code className="sync-command">
              0 * * * * cd /ruta/de/IMPORTADORA && ERP_SYNC_TRIGGER=AUTOMATIC npm run sync:facturador-products
            </code>
            <p className="muted">
              Puedes añadir `ERP_SYNC_MODE=NEW_ONLY` si quieres crear solo productos nuevos sin
              tocar los ya vinculados.
            </p>
          </article>

          <article className="sync-note-card">
            <strong>Estado actual del proyecto</strong>
            <p className="muted">
              Hoy el proyecto soporta `ERP → tienda`. La salida `tienda → ERP` todavía no está implementada, así que fotos, mayoristas y cambios web se guardan localmente.
            </p>
          </article>

          <article className="sync-note-card">
            <strong>Tiempo de referencia</strong>
            <p className="muted">
              {averageDurationMs !== null
                ? `Promedio reciente: ${formatDuration(averageDurationMs)} por sincronización completa.`
                : "Aún no hay suficientes ejecuciones cerradas para calcular un promedio."}
            </p>
          </article>
        </div>

        <div className="sync-history">
          <div className="sync-history-head">
            <div>
              <strong>Bitácora de sincronización</strong>
              <p className="muted">
                Últimas ejecuciones registradas desde admin o por tarea programada.
              </p>
            </div>
          </div>

          {syncLogs.length ? (
            <div className="sync-history-list">
              {syncLogs.map((log) => (
                <article className="sync-log-card" key={log.id}>
                  <div className="sync-log-top">
                    <div>
                      <p className="sync-log-title">{getTriggerLabel(log.trigger)}</p>
                      <p className="sync-log-meta">
                        {log.source} · {dateFormatter.format(new Date(log.startedAt))}
                      </p>
                    </div>
                    <span className={`sync-status-badge sync-status-${log.status.toLowerCase()}`}>
                      {getStatusLabel(log.status)}
                    </span>
                  </div>

                  <div className="sync-log-stats">
                    <span>Recibidos {log.fetchedCount}</span>
                    <span>Creados {log.createdCount}</span>
                    <span>Actualizados {log.updatedCount}</span>
                    <span>Omitidos {log.skippedCount}</span>
                  </div>

                  <div className="sync-log-foot">
                    <span>
                      {log.status === "CANCELED" && (log.canceledByName || log.canceledByEmail)
                        ? `Canceló ${log.canceledByName ?? log.canceledByEmail}`
                        : log.initiatedByName || log.initiatedByEmail
                        ? `Lanzado por ${log.initiatedByName ?? log.initiatedByEmail}`
                        : "Lanzado por sistema"}
                    </span>
                    <span>
                      {log.finishedAt
                        ? `Cerró ${dateFormatter.format(new Date(log.finishedAt))}`
                        : "Aún en ejecución"}
                    </span>
                    <SyncDuration
                      durationMs={log.durationMs}
                      finishedAt={log.finishedAt}
                      startedAt={log.startedAt}
                      status={log.status}
                    />
                  </div>

                  {log.errorMessage ? (
                    <p className="sync-log-error">{log.errorMessage}</p>
                  ) : null}

                  {log.status === "RUNNING" ? (
                    <form action={cancelErpSyncAction}>
                      <input name="syncLogId" type="hidden" value={log.id} />
                      <SubmitButton className="sync-cancel-button" pendingLabel="Cancelando...">
                        Cancelar sincronización
                      </SubmitButton>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">
              Todavía no hay ejecuciones registradas. La primera sincronización creará la bitácora.
            </p>
          )}
        </div>
      </section>

      <form action={updateSettingsAction} className="stack-lg">
        <div className="form-grid">
          <label className="field">
            <span>Nombre del negocio</span>
            <input defaultValue={settings.businessName} name="businessName" required />
          </label>
          <label className="field">
            <span>WhatsApp</span>
            <input defaultValue={settings.whatsappNumber} name="whatsappNumber" required />
          </label>
          <label className="field field-wide">
            <span>Título principal</span>
            <input defaultValue={settings.heroTitle} name="heroTitle" required />
          </label>
          <label className="field field-wide">
            <span>Descripción principal</span>
            <textarea defaultValue={settings.heroDescription} name="heroDescription" rows={4} />
          </label>
          <label className="field">
            <span>Segundos por slide</span>
            <input
              defaultValue={settings.heroAutoplaySeconds}
              max={20}
              min={2}
              name="heroAutoplaySeconds"
              required
              type="number"
            />
          </label>
          <label className="field field-wide">
            <span>Mensaje destacado</span>
            <textarea defaultValue={settings.highlightMessage} name="highlightMessage" rows={3} />
          </label>
          <label className="field field-wide">
            <span>Intro del pedido</span>
            <textarea defaultValue={settings.orderIntro} name="orderIntro" rows={3} />
          </label>
          <label className="field field-wide">
            <span>Cierre del pedido</span>
            <textarea defaultValue={settings.orderFooter} name="orderFooter" rows={3} />
          </label>
          <label className="field">
            <span>Moneda</span>
            <input defaultValue={settings.currencySymbol} name="currencySymbol" required />
          </label>
          <label className="field">
            <span>Horario</span>
            <input defaultValue={settings.supportHours} name="supportHours" required />
          </label>
          <label className="field">
            <span>Color de marca</span>
            <input defaultValue={settings.primaryColor} name="primaryColor" required type="color" />
          </label>
        </div>

        <HeroSlidesManager initialItems={settings.heroSlides} />

        <div className="actions-row">
          <SubmitButton>Guardar configuración</SubmitButton>
        </div>
      </form>
    </section>
  );
}
