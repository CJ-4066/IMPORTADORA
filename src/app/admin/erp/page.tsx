import {
  cancelErpSyncAction,
  syncProductsFromErpAction,
} from "@/app/admin/actions";
import { SyncDuration } from "@/components/admin/sync-duration";
import { getRecentErpSyncLogs, type ErpSyncLogView } from "@/lib/store";
import { SubmitButton } from "@/components/ui/submit-button";

type ErpPageProps = {
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

export default async function ErpPage({ searchParams }: ErpPageProps) {
  const syncLogs = await getRecentErpSyncLogs(5);
  const params = searchParams ? await searchParams : undefined;
  const syncStatus = typeof params?.syncStatus === "string" ? params.syncStatus : "";
  const syncError = typeof params?.syncError === "string" ? params.syncError : "";
  const syncMode = typeof params?.syncMode === "string" ? params.syncMode : "";
  const fetched = Number(typeof params?.fetched === "string" ? params.fetched : "0");
  const created = Number(typeof params?.created === "string" ? params.created : "0");
  const updated = Number(typeof params?.updated === "string" ? params.updated : "0");
  const skipped = Number(typeof params?.skipped === "string" ? params.skipped : "0");
  const syncModeLabel =
    syncMode === "INCREMENTAL"
      ? "incremental real"
      : syncMode === "NEW_ONLY"
        ? "solo vincular nuevos"
        : "sincronización completa";

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">ERP</p>
          <h1>Sincronización de productos</h1>
        </div>
      </div>

      {syncStatus === "success" ? (
        <p className="success-text">
          Sincronización completada ({syncModeLabel}). Recibidos: {fetched} · creados: {created} ·
          actualizados: {updated} · omitidos: {skipped}
        </p>
      ) : null}
      {syncStatus === "running" ? (
        <p className="success-text">
          Sincronización iniciada en segundo plano ({syncModeLabel}). Puedes seguir navegando.
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
        </div>

        <div className="sync-panel-grid">
          <article className="sync-note-card">
            <form action={syncProductsFromErpAction} className="sync-action-form">
              <input name="returnTo" type="hidden" value="/admin/erp" />
              <label className="field sync-mode-field">
                <span>Modo de sincronización</span>
                <select defaultValue={syncMode === "INCREMENTAL" ? "INCREMENTAL" : syncMode === "NEW_ONLY" ? "NEW_ONLY" : "FULL"} name="syncMode">
                  <option value="FULL">Sincronización completa</option>
                  <option value="NEW_ONLY">Solo vincular nuevos</option>
                  <option value="INCREMENTAL">Incremental real (requiere filtro ERP)</option>
                </select>
              </label>
              <SubmitButton pendingLabel="Sincronizando...">Sincronizar desde ERP</SubmitButton>
            </form>
          </article>
        </div>

        <div className="sync-history">
          <div className="sync-history-head">
            <div>
              <strong>Bitácora de sincronización</strong>
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
            <p>Sin ejecuciones.</p>
          )}
        </div>
      </section>
    </section>
  );
}
