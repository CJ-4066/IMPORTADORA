"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AiChannel, AiMode } from "@/lib/rocky-ai/policy";
import styles from "./RockyAi.module.css";

export const modeLabels: Record<AiMode, string> = { OFF: "Apagado", COPILOT: "Copiloto", HYBRID: "Híbrido", AUTO: "Automático" };
const stateLabels: Record<string, string> = { DRAFT: "Por revisar", QUEUED: "En cola", SENDING: "Enviando", SUBMITTED: "Enviado al canal", UNCERTAIN: "Entrega sin confirmar", EXPIRED: "Vencido", DISCARDED: "Descartado" };
type Draft = { id: string; text: string; state: string; reason: string | null; expiresAt: string };
type Status = {
  configured: boolean; enabled: boolean; owned: boolean; canSend: boolean; reason?: string; workerOnline: boolean;
  conversation: { mode: AiMode; humanControl: boolean; lastError: string | null } | null; drafts: Draft[];
};
export async function aiRequest(body: unknown) {
  const response = await fetch("/api/admin/rocky-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudo completar la acción.");
  return result;
}
function DraftEditor({ draft, disabled, perform }: { draft: Draft; disabled: boolean; perform: (body: unknown) => Promise<void> }) {
  const [text, setText] = useState(draft.text);
  return <article className={styles.draft}>
    <div className={styles.row}><strong>{stateLabels[draft.state] || draft.state}</strong><small>{new Date(draft.expiresAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</small></div>
    {draft.state === "DRAFT" ? <>
      <textarea aria-label="Editar sugerencia de Super Bot" maxLength={1000} rows={3} value={text} onChange={e => setText(e.target.value)} />
      <div className={styles.row}><button disabled={disabled || !text.trim()} onClick={() => void perform({ action: "approve", draftId: draft.id, text })}>Aprobar y enviar</button>
        <button disabled={disabled} className={styles.secondary} onClick={() => void perform({ action: "discard", draftId: draft.id })}>Descartar</button></div>
    </> : <p>{draft.text}</p>}
    {draft.reason && <small>{draft.reason}</small>}
    {draft.state === "UNCERTAIN" && <p role="alert">Comprueba la entrega en la conversación. Este envío no se repetirá automáticamente.</p>}
  </article>;
}
export function RockyAiPanel({ channel, externalId }: { channel: AiChannel; externalId: string }) {
  const [status, setStatus] = useState<Status | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AiMode>("COPILOT");
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/rocky-ai?channel=${channel}&externalId=${encodeURIComponent(externalId)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setStatus(data);
  }, [channel, externalId]);
  useEffect(() => {
    let live = true;
    const load = () => { if (live && !document.hidden) void refresh().catch(e => { if (live) setError(e.message); }); };
    load(); const timer = setInterval(load, 10000);
    return () => { live = false; clearInterval(timer); };
  }, [refresh]);
  const perform = async (body: unknown) => {
    setBusy(true); setError("");
    try { await aiRequest(body); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <details className={styles.panel}>
    <summary>Super Bot · {status?.conversation ? modeLabels[status.conversation.mode] : "Sin configurar"}
      {status?.conversation?.humanControl && " · Control humano"}{status?.drafts.some(d => d.state === "DRAFT") && " · Sugerencia disponible"}</summary>
    <div className={styles.body}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!status?.configured && <p className={styles.notice}>Conexión a OpenAI pendiente. Puedes preparar los modos; la IA no generará respuestas todavía.</p>}
      {status && !status.enabled && <p className={styles.notice}>Super Bot está desactivado globalmente. <Link href="/admin/mensajes/ia">Abrir configuración</Link></p>}
      {status && !status.workerOnline && <p className={styles.notice}>El procesador no está disponible. Los envíos quedarán pendientes hasta que se restablezca.</p>}
      {status?.reason && <p>{status.reason}</p>}{status?.conversation?.lastError && <p className={styles.error}>{status.conversation.lastError}</p>}
      <div className={styles.row}>
        <label>Modo <select value={mode} disabled={busy} onChange={e => setMode(e.target.value as AiMode)}>{Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button disabled={busy || !status} onClick={() => void perform({ action: "configure", channel, externalId, mode, humanControl: mode === "OFF" || mode === "COPILOT" })}>Aplicar modo</button>
        <button className={styles.secondary} disabled={busy || !status?.conversation} onClick={() => void perform({ action: "configure", channel, externalId, mode: status?.conversation?.mode || "OFF", humanControl: true })}>Tomar control</button>
      </div>
      <p className={styles.help}>Aplicar un modo pausa el bot anterior de esta conversación. Automático e Híbrido se aplican a mensajes nuevos; Copiloto solo envía lo que apruebes.</p>
      <div className={styles.row}>
        <button disabled={busy || !status?.configured || !status.enabled || !status.owned || !status.canSend || !status.conversation || status.conversation.mode === "OFF"} onClick={() => void perform({ action: "generate", channel, externalId })}>{busy ? "Procesando…" : "Generar sugerencia"}</button>
        <Link href="/admin/mensajes/ia">Configuración y actividad</Link>
      </div>
      {status?.drafts.map(d => <DraftEditor key={d.id + d.state} draft={d} disabled={busy || !status.enabled || !status.owned || !status.canSend || !status.workerOnline} perform={perform} />)}
    </div>
  </details>;
}
