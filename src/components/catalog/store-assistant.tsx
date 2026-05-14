"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Send, ShoppingCart, Sparkles, X } from "lucide-react";
import { STORE_CART_OPEN_EVENT } from "@/components/catalog/cart-events";
import {
  isCartStoreHydrated,
  rehydrateCartStore,
  useCartStore,
} from "@/components/catalog/cart-store";
import { getPublicProductName } from "@/lib/product-name";
import { formatCurrency } from "@/lib/utils";
import type {
  ShopAssistantProductCard,
  ShopAssistantQuickAction,
  ShopAssistantReply,
  ShopAssistantRequest,
} from "@/lib/shop-assistant-types";

export type StoreAssistantPanelProps = {
  businessName: string;
  open: boolean;
  onClose: () => void;
};

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  products?: ShopAssistantProductCard[];
  quickActions?: ShopAssistantQuickAction[];
  suggestedPrompts?: string[];
};

type AssistantConversationSnapshot = {
  messages: AssistantMessage[];
  contextProductCode: string | null;
  contextCategorySlug: string | null;
  welcomeDismissed?: boolean;
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
    text: `Dime presupuesto, ocasión o uso y te propongo opciones de ${businessName}.`,
    quickActions: [
      { label: "Ver ofertas", href: "/?featured=1", accent: true },
      { label: "Buscar producto", href: "/?focus=search" },
      { label: "Recomiéndame uno", href: "/?featured=1" },
    ],
    suggestedPrompts: [
      "Busco audífonos por 25 soles",
      "Muéstrame algo para regalar",
      "Necesito un producto con stock",
      "Quiero ver ofertas",
    ],
  };
}

function getMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getAssistantStorageKey(businessName: string) {
  const normalized = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `importadora-store-assistant:${normalized || "default"}`;
}

function isLegacyWelcomeMessage(message: AssistantMessage) {
  return (
    message.role === "assistant" &&
    (
      message.id === "assistant-welcome" ||
      message.text.includes("Puedo buscar productos por código") ||
      message.text.includes("Consulta código, precio, categoría") ||
      message.quickActions?.some(
        (action) => action.label === "Buscar catálogo" || action.label === "Ver ofertas",
      ) === true
    )
  );
}

function normalizeAssistantMessages(
  messages: AssistantMessage[],
  businessName: string,
) {
  if (!messages.length) {
    return [buildWelcomeMessage(businessName)];
  }

  const normalized = [...messages];

  if (isLegacyWelcomeMessage(normalized[0])) {
    normalized[0] = buildWelcomeMessage(businessName);
  }

  return normalized;
}

function readAssistantSnapshot(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AssistantConversationSnapshot>;

    if (!Array.isArray(parsed.messages)) {
      return null;
    }

    const messages = parsed.messages.filter(
      (message): message is AssistantMessage =>
        Boolean(message) &&
        typeof message.id === "string" &&
        (message.role === "assistant" || message.role === "user") &&
        typeof message.text === "string",
    );

    if (!messages.length) {
      return null;
    }

    return {
      messages,
      contextProductCode:
        typeof parsed.contextProductCode === "string" ? parsed.contextProductCode : null,
      contextCategorySlug:
        typeof parsed.contextCategorySlug === "string" ? parsed.contextCategorySlug : null,
      welcomeDismissed: parsed.welcomeDismissed === true,
    };
  } catch {
    return null;
  }
}

function saveAssistantSnapshot(
  storageKey: string,
  snapshot: AssistantConversationSnapshot,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures in private mode or quota-constrained browsers.
  }
}

function clearAssistantSnapshot(storageKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures.
  }
}

function AssistantProductCard({ product }: AssistantProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const displayName = getPublicProductName(product.name);
  const [added, setAdded] = useState(false);
  const quantity = Math.max(1, Math.min(product.recommendedQuantity ?? 1, product.stockUnits));

  const handleAddToCart = async () => {
    if (!isCartStoreHydrated()) {
      await rehydrateCartStore();
    }

    addItem(
      {
        id: product.id,
        code: product.code,
        slug: product.slug,
        name: displayName,
        description: null,
        brand: product.brand,
        category: product.category,
        categoryId: null,
        imageUrl: null,
        media: [],
        primaryMedia: null,
        unitLabel: "unidad",
        unitPrice: product.unitPriceValue,
        wholesalePrice: product.wholesalePriceValue,
        wholesaleMinQty: product.wholesaleMinQty,
        boxPrice: null,
        unitsPerBox: product.unitsPerBox,
        stockUnits: product.stockUnits,
        isVisible: true,
        isFeatured: false,
        syncEnabled: true,
        lastSyncedAt: null,
        updatedAt: new Date().toISOString(),
        hasPhoto: false,
      },
      "unit",
      quantity,
    );

    setAdded(true);
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(STORE_CART_OPEN_EVENT));
    });
  };

  return (
    <div className="store-assistant-product-card">
      <div className="store-assistant-product-top">
        <span className="product-code">{product.code}</span>
        <span className="store-assistant-availability">
          {product.availabilityLabel} · {product.stockUnits}
        </span>
      </div>

      <strong>{displayName}</strong>
      <span className="store-assistant-product-meta">
        {product.brand ?? product.category ?? "Catálogo"}
      </span>

      <div className="store-assistant-product-prices">
        <span>Unitario {formatCurrency(Number(product.unitPrice))}</span>
        {product.wholesalePrice ? (
          <span>
            Mayorista {formatCurrency(Number(product.wholesalePrice))} desde {product.wholesaleMinQty}
          </span>
        ) : null}
      </div>

      {product.recommendationReason ? (
        <p className="store-assistant-product-reason">{product.recommendationReason}</p>
      ) : null}

      <div className="store-assistant-product-actions">
        <button
          className="button button-primary"
          disabled={product.stockUnits <= 0}
          onClick={() => void handleAddToCart()}
          type="button"
        >
          <ShoppingCart size={15} />
          {added
            ? "Agregado"
            : quantity > 1
              ? `Agregar ${quantity}`
              : "Agregar"}
        </button>
        <Link className="button button-secondary" href={`/producto/${product.slug}`}>
          Ver
        </Link>
      </div>
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

function AssistantWelcomeBanner({
  message,
  onDismiss,
}: {
  message: AssistantMessage;
  onDismiss: () => void;
}) {
  return (
    <div className="store-assistant-welcome">
      <div className="store-assistant-welcome-head">
        <span className="store-assistant-badge">
          <Sparkles size={14} />
          Compra guiada
        </span>
        <button aria-label="Ocultar mensaje" className="icon-button" onClick={onDismiss} type="button">
          <X size={16} />
        </button>
      </div>

      <p className="store-assistant-welcome-text">{message.text}</p>
      <AssistantActions message={message} />
    </div>
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

export function StoreAssistantPanel({
  businessName,
  onClose,
  open,
}: StoreAssistantPanelProps) {
  const storageKey = useMemo(() => getAssistantStorageKey(businessName), [businessName]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    buildWelcomeMessage(businessName),
  ]);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const contextProductCodeRef = useRef<string | null>(null);
  const contextCategorySlugRef = useRef<string | null>(null);
  const didHydrateRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const snapshot = readAssistantSnapshot(storageKey);

    const timer = window.setTimeout(() => {
      if (!snapshot) {
        setMessages([buildWelcomeMessage(businessName)]);
        setWelcomeDismissed(false);
        contextProductCodeRef.current = null;
        contextCategorySlugRef.current = null;
      } else {
        setMessages(normalizeAssistantMessages(snapshot.messages, businessName));
        setWelcomeDismissed(snapshot.welcomeDismissed === true);
        contextProductCodeRef.current = snapshot.contextProductCode;
        contextCategorySlugRef.current = snapshot.contextCategorySlug;
      }

      didHydrateRef.current = true;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [businessName, storageKey]);

  useEffect(() => {
    if (!didHydrateRef.current) {
      return;
    }

    saveAssistantSnapshot(storageKey, {
      messages,
      contextProductCode: contextProductCodeRef.current,
      contextCategorySlug: contextCategorySlugRef.current,
      welcomeDismissed,
    });
  }, [messages, storageKey, welcomeDismissed]);

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

    setWelcomeDismissed(true);

    const userMessage: AssistantMessage = {
      id: getMessageId(),
      role: "user",
      text: cleanText,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setLoading(true);

    try {
      const recentMessages = [...messages.slice(-5), userMessage].map((message) => ({
        role: message.role,
        text: message.text,
      }));

      const payload: ShopAssistantRequest = {
        message: cleanText,
        productContextCode: contextProductCodeRef.current,
        contextCategorySlug: contextCategorySlugRef.current,
        recentMessages,
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

  const clearHistory = () => {
    clearAssistantSnapshot(storageKey);
    setWelcomeDismissed(false);
    contextProductCodeRef.current = null;
    contextCategorySlugRef.current = null;
    setDraft("");
    setMessages([buildWelcomeMessage(businessName)]);
  };

  const welcomeMessage = messages[0];
  const hasWelcomeIntro = Boolean(welcomeMessage && isLegacyWelcomeMessage(welcomeMessage));
  const showWelcomeBanner =
    hasWelcomeIntro &&
    !welcomeDismissed &&
    draft.trim().length === 0 &&
    Boolean(welcomeMessage);
  const visibleMessages = hasWelcomeIntro ? messages.slice(1) : messages;

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        aria-label="Cerrar asistente"
        className="store-assistant-backdrop"
        onClick={onClose}
        type="button"
      />

      <section className="store-assistant-panel" role="dialog" aria-label="Asistente de compra">
        <header className="store-assistant-head">
          <div className="store-assistant-head-copy">
            <span className="store-assistant-badge">
              <Sparkles size={14} />
              Compra guiada
            </span>
            <strong>Asistente de compra</strong>
            <p>Dime presupuesto, categoría o uso y te muestro opciones.</p>
          </div>

          <button className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="store-assistant-toolbar">
          <button className="button button-secondary" onClick={clearHistory} type="button">
            Limpiar chat
          </button>
        </div>

        <div className="store-assistant-body" ref={bodyRef}>
          {showWelcomeBanner ? (
            <AssistantWelcomeBanner
              message={welcomeMessage}
              onDismiss={() => setWelcomeDismissed(true)}
            />
          ) : null}

          {visibleMessages.map((message) => (
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
          onDraftChange={(value) => {
            setDraft(value);
            if (value.trim().length > 0) {
              setWelcomeDismissed(true);
            }
          }}
          onSend={(text) => {
            void sendMessage(text);
          }}
          suggestedPrompts={suggestedPrompts}
        />
      </section>
    </>
  );
}
