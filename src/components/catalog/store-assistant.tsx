"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, MessageSquareText, Send, Sparkles, X } from "lucide-react";
import type {
  ShopAssistantProductCard,
  ShopAssistantQuickAction,
  ShopAssistantReply,
  ShopAssistantRequest,
} from "@/lib/shop-assistant-types";

type StoreAssistantProps = {
  businessName: string;
};

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  products?: ShopAssistantProductCard[];
  quickActions?: ShopAssistantQuickAction[];
  suggestedPrompts?: string[];
};

type AssistantProductCardProps = {
  product: ShopAssistantProductCard;
};

type AssistantMessageCardProps = {
  message: AssistantMessage;
};

function buildWelcomeMessage(businessName: string): AssistantMessage {
  return {
    id: "assistant-welcome",
    role: "assistant",
    text:
      `Soy el asistente de compra de ${businessName}. ` +
      "Puedo buscar productos por código, nombre, categoría, ofertas, compra o disponibilidad general.",
    quickActions: [
      { label: "Ver ofertas", href: "/?featured=1", accent: true },
      { label: "Buscar catálogo", href: "/?focus=search" },
    ],
    suggestedPrompts: [
      "Busca el código 101-32",
      "Muéstrame ofertas",
      "¿Qué categorías tienes?",
      "¿Cómo cotizo mi pedido?",
    ],
  };
}

function getMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function AssistantProductCard({ product }: AssistantProductCardProps) {
  return (
    <div className="store-assistant-product-card">
      <div className="store-assistant-product-top">
        <span className="product-code">{product.code}</span>
        <span className="store-assistant-availability">
          {product.availabilityLabel} · {product.stockUnits}
        </span>
      </div>

      <strong>{product.name}</strong>
      <span className="store-assistant-product-meta">
        {product.brand ?? product.category ?? "Catálogo"}
      </span>

      <div className="store-assistant-product-prices">
        <span>Unitario {product.unitPrice}</span>
        {product.wholesalePrice ? (
          <span>
            Mayorista {product.wholesalePrice} desde {product.wholesaleMinQty}
          </span>
        ) : null}
      </div>

      <Link className="button button-secondary" href={`/producto/${product.slug}`}>
        Ver producto
      </Link>
    </div>
  );
}

function AssistantActions({ message }: { message: AssistantMessage }) {
  if (!message.quickActions?.length) {
    return null;
  }

  return (
    <div className="store-assistant-actions">
      {message.quickActions.map((action) =>
        action.href.startsWith("http") ? (
          <a
            className={`store-assistant-action-pill ${action.accent ? "is-accent" : ""}`}
            href={action.href}
            key={`${message.id}-${action.href}-${action.label}`}
            rel="noreferrer"
            target="_blank"
          >
            {action.label}
          </a>
        ) : (
          <Link
            className={`store-assistant-action-pill ${action.accent ? "is-accent" : ""}`}
            href={action.href}
            key={`${message.id}-${action.href}-${action.label}`}
          >
            {action.label}
          </Link>
        ),
      )}
    </div>
  );
}

function AssistantMessageCard({ message }: AssistantMessageCardProps) {
  return (
    <article
      className={`store-assistant-message ${message.role === "user" ? "is-user" : "is-assistant"}`}
    >
      <div className="store-assistant-bubble">
        <p>{message.text}</p>

        {message.products?.length ? (
          <div className="store-assistant-products">
            {message.products.map((product) => (
              <AssistantProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : null}

        <AssistantActions message={message} />
      </div>
    </article>
  );
}

function AssistantFooter({
  canSend,
  draft,
  onDraftChange,
  onSend,
  suggestedPrompts,
  inputRef,
}: {
  canSend: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (text: string) => void;
  suggestedPrompts: string[];
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <footer className="store-assistant-footer">
      {suggestedPrompts.length ? (
        <div className="store-assistant-prompts">
          {suggestedPrompts.map((prompt) => (
            <button
              className="store-assistant-prompt"
              key={prompt}
              onClick={() => onSend(prompt)}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="store-assistant-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSend(draft);
        }}
      >
        <input
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Escribe un código, nombre o pregunta..."
          ref={inputRef}
          value={draft}
        />
        <button className="button button-primary" disabled={!canSend} type="submit">
          <Send size={16} />
          Enviar
        </button>
      </form>
    </footer>
  );
}

export function StoreAssistant({ businessName }: StoreAssistantProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    buildWelcomeMessage(businessName),
  ]);
  const contextProductCodeRef = useRef<string | null>(null);
  const contextCategorySlugRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  }, [open]);

  useEffect(() => {
    if (!bodyRef.current) {
      return;
    }

    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, loading]);

  const canSend = draft.trim().length > 0 && !loading;
  const suggestedPrompts = useMemo(() => {
    const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    return latestAssistant?.suggestedPrompts ?? [];
  }, [messages]);

  const sendMessage = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || loading) {
      return;
    }

    const userMessage: AssistantMessage = {
      id: getMessageId(),
      role: "user",
      text: cleanText,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setLoading(true);

    try {
      const payload: ShopAssistantRequest = {
        message: cleanText,
        productContextCode: contextProductCodeRef.current,
        contextCategorySlug: contextCategorySlugRef.current,
        recentMessages: messages.slice(-6).map((message) => ({
          role: message.role,
          text: message.text,
        })),
      };

      const response = await fetch("/api/shop-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Assistant request failed");
      }

      const reply = (await response.json()) as ShopAssistantReply;

      contextProductCodeRef.current = reply.contextProductCode ?? null;
      contextCategorySlugRef.current = reply.contextCategorySlug ?? null;
      setMessages((current) => [
        ...current,
        {
          id: getMessageId(),
          role: "assistant",
          text: reply.text,
          products: reply.products,
          quickActions: reply.quickActions,
          suggestedPrompts: reply.suggestedPrompts,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: getMessageId(),
          role: "assistant",
          text: "No pude responder en este momento. Intenta con un código, nombre o categoría.",
          suggestedPrompts: [
            "Busca por código",
            "Muéstrame ofertas",
            "¿Cómo envío mi pedido?",
          ],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="store-side-action store-side-action-assistant"
        onClick={() => {
          startTransition(() => setOpen(true));
        }}
        type="button"
      >
        <MessageSquareText size={20} />
        <span>Asistente</span>
      </button>

      {open ? (
        <>
          <button
            aria-label="Cerrar asistente"
            className="store-assistant-backdrop"
            onClick={() => setOpen(false)}
            type="button"
          />

          <section className="store-assistant-panel" role="dialog" aria-label="Asistente de compra">
            <header className="store-assistant-head">
              <div className="store-assistant-head-copy">
                <span className="store-assistant-badge">
                  <Sparkles size={14} />
                  Catálogo real
                </span>
                <strong>Asistente de compra</strong>
                <p>Consulta código, precio, categoría, ofertas o compra.</p>
              </div>

              <button className="icon-button" onClick={() => setOpen(false)} type="button">
                <X size={18} />
              </button>
            </header>

            <div className="store-assistant-body" ref={bodyRef}>
              {messages.map((message) => (
                <AssistantMessageCard key={message.id} message={message} />
              ))}

              {loading ? (
                <div className="store-assistant-loading">
                  <LoaderCircle className="store-assistant-spinner" size={18} />
                  <span>Consultando catálogo...</span>
                </div>
              ) : null}
            </div>

            <AssistantFooter
              canSend={canSend}
              draft={draft}
              inputRef={inputRef}
              onDraftChange={setDraft}
              onSend={(text) => {
                void sendMessage(text);
              }}
              suggestedPrompts={suggestedPrompts}
            />
          </section>
        </>
      ) : null}
    </>
  );
}
