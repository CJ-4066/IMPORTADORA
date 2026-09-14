"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Bug, RefreshCw, Send, UserRound } from "lucide-react";
import type { ChatMessage } from "@/types/messages";

type SimulatorResponse = {
  botError: string | null;
  botSkipped: boolean;
  conversationId: string;
  messages: ChatMessage[];
};

function createSessionKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageSimulator() {
  const [content, setContent] = useState("");
  const [name, setName] = useState("Cliente Simulador");
  const [phone, setPhone] = useState("+51 999 888 777");
  const [sessionKey, setSessionKey] = useState(() => createSessionKey());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const canSend = content.trim().length > 0 && !busy;
  const conversationLabel = useMemo(() => phone.trim() || "sin telefono", [phone]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    const message = content.trim();
    setContent("");
    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/conversations/simulate", {
        body: JSON.stringify({
          content: message,
          name,
          phone,
          sessionKey,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json()) as Partial<SimulatorResponse> & { error?: string };
      if (!response.ok || !payload.messages) {
        throw new Error(payload.error || "No se pudo simular el mensaje.");
      }

      setMessages(payload.messages);

      if (payload.botSkipped) {
        setNotice("Bot global apagado en configuración.");
      } else if (payload.botError) {
        setNotice(payload.botError);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo simular el mensaje.");
    } finally {
      setBusy(false);
    }
  }

  function handleNewSession() {
    setSessionKey(createSessionKey());
    setMessages([]);
    setContent("");
    setNotice(null);
  }

  return (
    <div className="message-simulator">
      <aside className="message-simulator-panel">
        <div className="message-simulator-title">
          <div className="message-simulator-icon">
            <Bug size={20} />
          </div>
          <div>
            <h1>Simulador</h1>
            <p>{conversationLabel}</p>
          </div>
        </div>

        <label className="simulator-field">
          <span>Cliente</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="simulator-field">
          <span>Telefono</span>
          <input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>

        <button className="btn btn-outline" onClick={handleNewSession} type="button">
          <RefreshCw size={14} />
          Nueva sesion
        </button>
      </aside>

      <section className="message-simulator-chat">
        <div className="message-simulator-chat-header">
          <div>
            <h2>{name || "Cliente Simulador"}</h2>
            <p>Prueba respuestas sin enviar mensajes reales</p>
          </div>
          <span className="conversation-badge badge-automatico">AUTOMATICO</span>
        </div>

        <div className="message-simulator-messages">
          {messages.length === 0 ? (
            <div className="message-simulator-empty">
              <Bot size={44} />
              <p>Escribe una consulta como cliente para ver la respuesta del bot.</p>
            </div>
          ) : (
            messages.map((message) => {
              const isCustomer = message.senderType === "CUSTOMER";
              const isBot = message.senderType === "BOT";

              return (
                <div
                  className={`simulator-bubble ${isCustomer ? "is-customer" : "is-bot"}`}
                  key={message.id}
                >
                  <div className="simulator-bubble-meta">
                    {isCustomer ? <UserRound size={13} /> : <Bot size={13} />}
                    <span>{isCustomer ? "Cliente" : isBot ? "Bot" : "Sistema"}</span>
                  </div>
                  <p>{message.content}</p>
                  <time>{formatTime(message.createdAt)}</time>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {notice ? <div className="message-simulator-notice">{notice}</div> : null}

        <form className="message-simulator-input" onSubmit={handleSubmit}>
          <textarea
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Escribe como cliente..."
            rows={2}
            value={content}
          />
          <button className="btn btn-primary" disabled={!canSend} type="submit">
            <Send size={15} />
            {busy ? "Enviando" : "Enviar"}
          </button>
        </form>
      </section>
    </div>
  );
}
