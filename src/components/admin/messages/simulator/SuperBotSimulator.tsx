"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, CircleAlert, FlaskConical, RotateCcw, Send, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import styles from "./SuperBotSimulator.module.css";

type Turn = { role: "user" | "assistant"; text: string };
type Connection = "checking" | "missing" | "ready" | "verified" | "rejected";
type SimulationReply = { text?: string; model?: string; providerUsed?: boolean; reason?: string; notice?: string; error?: string };

const examples = [
  "Hola, busco una licuadora.",
  "¿Cuánto cuesta el producto HY300?",
  "¿Cómo puedo pagar?",
  "¿Me hacen descuento?",
];

function connectionLabel(connection: Connection) {
  if (connection === "checking") return "Comprobando servidor…";
  if (connection === "missing") return "Clave no detectada";
  if (connection === "verified") return "OpenAI verificado";
  if (connection === "rejected") return "Clave rechazada por OpenAI";
  return "Clave detectada: envía una prueba";
}

export function SuperBotSimulator() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState<Connection>("checking");
  const [model, setModel] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/rocky-ai", { cache: "no-store" })
      .then(async response => ({ ok: response.ok, data: await response.json() as { configured?: boolean; config?: { model?: string } } }))
      .then(({ ok, data }) => {
        if (!active) return;
        setConnection(ok && data.configured ? "ready" : "missing");
        setModel(data.config?.model || "");
      })
      .catch(() => { if (active) setConnection("missing"); });
    return () => { active = false; };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [turns, busy]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    const history = [...turns, { role: "user" as const, text }].slice(-12);
    setTurns(history);
    setMessage("");
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/rocky-ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate_live", history }),
      });
      const payload = await response.json() as SimulationReply;
      if (!response.ok || !payload.text) {
        if (response.status === 409 && /clave|OpenAI/i.test(payload.error || "")) setConnection("rejected");
        throw new Error(payload.error || "No se pudo obtener una respuesta de prueba.");
      }
      setTurns(current => [...current, { role: "assistant", text: payload.text! }].slice(-12));
      if (payload.providerUsed) setConnection("verified");
      else setConnection(current => current === "rejected" ? current : "ready");
      setModel(payload.model || model);
      setNotice(payload.notice || "Respuesta generada sin enviar mensajes a ningún canal.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo completar la prueba.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(message);
  }

  function reset() {
    if (busy) return;
    setTurns([]);
    setMessage("");
    setNotice("");
  }

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.eyebrow}><FlaskConical size={15} />Laboratorio controlado</div>
      <div className={styles.heroGrid}>
        <div><h1>Prueba a Super Bot</h1><p>Habla con la versión real de OpenAI antes de ponerla frente a un cliente.</p></div>
        <div className={styles.connection} data-state={connection}>
          <span className={styles.dot} /><div><strong>{connectionLabel(connection)}</strong><small>{model || "Modelo del servidor"}</small></div>
        </div>
      </div>
    </header>

    <section className={styles.workspace}>
      <aside className={styles.brief}>
        <div className={styles.briefMark}><ShieldCheck size={19} /></div>
        <h2>Entorno aislado</h2>
        <p>Usa las reglas, precios publicados y catálogo real. No crea conversaciones, borradores ni envíos.</p>
        <ul><li>Sin activar canales</li><li>Sin contacto real</li><li>Sin confirmar pagos</li><li>Sin revelar stock</li></ul>
        <div className={styles.examples}><span>Prueba una situación</span>{examples.map(example => <button key={example} disabled={busy} onClick={() => setMessage(example)} type="button">{example}</button>)}</div>
        <button className={styles.reset} disabled={busy || turns.length === 0} onClick={reset} type="button"><RotateCcw size={15} />Nueva prueba</button>
      </aside>

      <section className={styles.chat} aria-label="Conversación de prueba con Super Bot">
        <header className={styles.chatHeader}><div><span>SUPER BOT</span><h2>Conversación de prueba</h2></div><div className={styles.safeMark}><Sparkles size={15} />Sin envíos</div></header>
        <div className={styles.messages}>
          {!turns.length ? <div className={styles.empty}><Bot size={42} /><h3>Empieza como un cliente</h3><p>Por ejemplo: “Busco un producto” o “¿Cómo puedo pagar?”.</p></div> : turns.map((turn, index) => <article className={turn.role === "user" ? styles.userTurn : styles.botTurn} key={`${turn.role}-${index}-${turn.text.slice(0, 24)}`}>
            <div className={styles.turnLabel}>{turn.role === "user" ? <><UserRound size={14} />Cliente de prueba</> : <><Bot size={14} />Super Bot</>}</div><p>{turn.text}</p>
          </article>)}
          {busy && <article className={styles.typing}><Bot size={15} /><span>Super Bot está verificando catálogo y reglas…</span></article>}
          <div ref={endRef} />
        </div>
        {notice && <p className={styles.notice}><CircleAlert size={15} />{notice}</p>}
        <form className={styles.composer} onSubmit={submit}>
          <label htmlFor="simulator-message">Mensaje del cliente</label>
          <div><textarea autoComplete="off" disabled={busy} id="simulator-message" maxLength={600} onChange={event => setMessage(event.target.value)} placeholder="Escribe aquí la consulta que haría un cliente…" rows={3} value={message} /><button aria-label="Probar mensaje" disabled={busy || !message.trim()} type="submit"><Send size={17} /></button></div>
          <small>La prueba consume una llamada real de OpenAI y queda limitada para proteger el presupuesto.</small>
        </form>
      </section>
    </section>
  </main>;
}
