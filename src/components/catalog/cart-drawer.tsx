"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  MessageCircleMore,
  Minus,
  Plus,
  RefreshCcw,
  ShoppingCart,
  Trash2,
  UserRoundCheck,
  X,
} from "lucide-react";
import { STORE_CART_OPEN_EVENT } from "@/components/catalog/cart-events";
import { rehydrateCartStore } from "@/components/catalog/cart-store";
import { getSafeMediaUrl } from "@/lib/media-url";
import { getLinePricing } from "@/lib/pricing";
import type { StoreSettingsView } from "@/lib/store";
import { buildPublicWhatsappHref, formatCurrency } from "@/lib/utils";
import { useCartStore } from "@/components/catalog/cart-store";

type CartDrawerProps = {
  settings: StoreSettingsView;
  initialOpen?: boolean;
  quoteDefaults?: QuoteDraftDefaults | null;
};

type QuoteDraftDefaults = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type QuoteDraft = {
  name: string;
  phone: string;
  email: string;
  documentType: string;
  documentNumber: string;
  address: string;
  note: string;
};

type QuoteStatusStep = {
  status: "success" | "warning" | "error";
  text: string;
};

type CartLine = {
  item: ReturnType<typeof useCartStore.getState>["items"][number];
  pricing: ReturnType<typeof getLinePricing>;
};

const DOCUMENT_TYPE_OPTIONS = [
  { label: "Sin documento", value: "" },
  { label: "DNI", value: "1" },
  { label: "RUC", value: "6" },
  { label: "Carnet ext.", value: "4" },
  { label: "Pasaporte", value: "7" },
] as const;

function buildInitialQuoteDraft(
  settings: StoreSettingsView,
  defaults?: QuoteDraftDefaults | null,
): QuoteDraft {
  return {
    address: "",
    documentNumber: "",
    documentType: "",
    email: defaults?.email?.trim() ?? "",
    name: defaults?.name?.trim() ?? "",
    note: settings.orderFooter,
    phone: defaults?.phone?.trim() ?? "",
  };
}

function CartHeader({
  onClose,
  onToggleQuoteForm,
  quoteFormOpen,
}: {
  onClose: () => void;
  onToggleQuoteForm: () => void;
  quoteFormOpen: boolean;
}) {
  return (
    <div className="cart-header">
      <div>
        <p className="eyebrow">Compra rápida</p>
        <h2>Carrito de compra</h2>
      </div>
      <div className="cart-header-actions">
        <button className="button button-ghost cart-header-quote" onClick={onToggleQuoteForm} type="button">
          <FileText size={16} />
          {quoteFormOpen ? "Cerrar" : "Cotizar"}
        </button>
        <button className="icon-button" onClick={onClose} type="button">
          ×
        </button>
      </div>
    </div>
  );
}

function CartList({
  currencySymbol,
  onRemove,
  onSetQuantity,
  orderLines,
}: {
  currencySymbol: string;
  onRemove: (key: string) => void;
  onSetQuantity: (key: string, quantity: number) => void;
  orderLines: CartLine[];
}) {
  return (
    <div className="cart-list">
      {orderLines.map(({ item, pricing }) => (
        <article className="cart-item" key={item.key}>
          <div className="cart-item-main">
            <div className="cart-item-thumb">
              {getSafeMediaUrl(item.imageUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={item.imageAlt ?? item.name}
                  decoding="async"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={getSafeMediaUrl(item.imageUrl) ?? undefined}
                />
              ) : (
                <span>{item.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>

            <div className="stack-xs">
              <div className="cart-item-head">
                <h3>{item.name}</h3>
                <button className="icon-button" onClick={() => onRemove(item.key)} type="button">
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="muted">
                {item.code} · {pricing.tierLabel}
              </p>
              <p className="cart-total">{formatCurrency(pricing.total, currencySymbol)}</p>
            </div>
          </div>

          <div className="qty-control">
            <button onClick={() => onSetQuantity(item.key, item.quantity - 1)} type="button">
              <Minus size={16} />
            </button>
            <span>{item.quantity}</span>
            <button onClick={() => onSetQuantity(item.key, item.quantity + 1)} type="button">
              <Plus size={16} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function CartFooter({
  currencySymbol,
  onClear,
  onOpenQuoteForm,
  quoteState,
  quoteMessage,
  quoteMessageTone,
  quoteStatusSteps,
  quoteWhatsappHref,
  totalAmount,
  totalSavings,
  whatsappHref,
}: {
  currencySymbol: string;
  onClear: () => void;
  onOpenQuoteForm: () => void;
  quoteState: "idle" | "loading" | "success" | "error";
  quoteMessage: string;
  quoteMessageTone: "success" | "error" | "neutral";
  quoteStatusSteps: QuoteStatusStep[];
  quoteWhatsappHref: string | null;
  totalAmount: number;
  totalSavings: number;
  whatsappHref: string;
}) {
  return (
    <div className="cart-footer">
      <div className="summary-row">
        <span>Total estimado</span>
        <strong>{formatCurrency(totalAmount, currencySymbol)}</strong>
      </div>
      {totalSavings > 0 ? (
        <div className="summary-row">
          <span>Ahorro por mayorista</span>
          <strong>{formatCurrency(totalSavings, currencySymbol)}</strong>
        </div>
      ) : null}

      <div className="cart-footer-actions">
        <button className="button button-primary" onClick={onOpenQuoteForm} type="button">
          <FileText size={18} />
          Completar cotización
        </button>
        <a className="button button-secondary" href={whatsappHref} rel="noreferrer" target="_blank">
          <MessageCircleMore size={18} />
          Enviar pedido
        </a>
      </div>

      {quoteWhatsappHref ? (
        <a className="button button-ghost" href={quoteWhatsappHref} rel="noreferrer" target="_blank">
          <MessageCircleMore size={18} />
          Enviar cotización al cliente
        </a>
      ) : null}

      {quoteState === "loading" ? (
        <p className="muted">Enviando solicitud y validando disponibilidad...</p>
      ) : null}

      {quoteMessage ? (
        <p className={quoteMessageTone === "error" ? "error-text" : quoteMessageTone === "success" ? "success-text" : "muted"}>
          {quoteMessage}
        </p>
      ) : null}

      {quoteStatusSteps.length ? (
        <div className="cart-quote-status">
          {quoteStatusSteps.map((step, index) => (
            <p
              className={`cart-quote-status-item is-${step.status}`}
              key={`${step.status}-${index}-${step.text}`}
            >
              <span>{step.status === "success" ? "OK" : step.status === "warning" ? "AV" : "ER"}</span>
              {step.text}
            </p>
          ))}
        </div>
      ) : null}

      <button className="button button-ghost" onClick={onClear} type="button">
        Vaciar carrito
      </button>
    </div>
  );
}

function QuoteForm({
  draft,
  hasAccountDefaults,
  onChange,
  onClose,
  onReset,
  onSubmit,
  quoteState,
}: {
  draft: QuoteDraft;
  hasAccountDefaults: boolean;
  onChange: (field: keyof QuoteDraft, value: string) => void;
  onClose: () => void;
  onReset: () => void;
  onSubmit: () => void;
  quoteState: "idle" | "loading" | "success" | "error";
}) {
  return (
    <section className="cart-quote-form">
      <div className="cart-quote-head">
        <div className="stack-xs">
          <p className="eyebrow">Datos de compra</p>
          <h3>Enviar solicitud de cotización</h3>
          <p className="muted">
            {hasAccountDefaults
              ? "Cargamos tus datos de cuenta para acelerar la cotización. Puedes corregirlos antes de enviar."
              : "Completa tus datos de contacto, documento y observaciones antes de enviar la solicitud."}
          </p>
        </div>
        <button className="icon-button" onClick={onClose} type="button">
          <X size={16} />
        </button>
      </div>

      {hasAccountDefaults ? (
        <div className="cart-quote-account-note">
          <div className="cart-quote-account-note-copy">
            <UserRoundCheck size={16} />
            <span>Usando datos precargados del comprador registrado.</span>
          </div>
          <button className="button button-ghost" onClick={onReset} type="button">
            <RefreshCcw size={15} />
            Restaurar mis datos
          </button>
        </div>
      ) : null}

      <div className="cart-quote-grid">
        <label className="field-stack">
          <span>Nombre o razón social</span>
          <input
            onChange={(event) => onChange("name", event.target.value)}
            placeholder="Ej. Comercial Pérez SAC"
            type="text"
            value={draft.name}
          />
        </label>
        <label className="field-stack">
          <span>Teléfono</span>
          <input
            onChange={(event) => onChange("phone", event.target.value)}
            placeholder="Ej. 987654321"
            type="tel"
            value={draft.phone}
          />
        </label>
        <label className="field-stack">
          <span>Correo</span>
          <input
            onChange={(event) => onChange("email", event.target.value)}
            placeholder="cliente@empresa.com"
            type="email"
            value={draft.email}
          />
        </label>
        <label className="field-stack">
          <span>Tipo de documento</span>
          <select onChange={(event) => onChange("documentType", event.target.value)} value={draft.documentType}>
            {DOCUMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value || "none"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-stack">
          <span>Número de documento</span>
          <input
            onChange={(event) => onChange("documentNumber", event.target.value)}
            placeholder="DNI o RUC"
            type="text"
            value={draft.documentNumber}
          />
        </label>
        <label className="field-stack cart-quote-grid-full">
          <span>Dirección</span>
          <input
            onChange={(event) => onChange("address", event.target.value)}
            placeholder="Dirección de entrega o referencia"
            type="text"
            value={draft.address}
          />
        </label>
        <label className="field-stack cart-quote-grid-full">
          <span>Observaciones</span>
          <textarea
            onChange={(event) => onChange("note", event.target.value)}
            placeholder="Notas comerciales, entrega o confirmación"
            rows={3}
            value={draft.note}
          />
        </label>
      </div>

      <button className="button button-primary" disabled={quoteState === "loading"} onClick={onSubmit} type="button">
        <FileText size={18} />
        {quoteState === "loading" ? "Enviando..." : "Enviar solicitud"}
      </button>
    </section>
  );
}

function EmptyCartState() {
  return (
    <div className="cart-empty">
      <ShoppingCart size={22} />
      <p>Agrega productos y arma el pedido sin salir del catálogo.</p>
    </div>
  );
}

export function CartDrawer({
  settings,
  initialOpen = false,
  quoteDefaults = null,
}: CartDrawerProps) {
  const { items, hydrated, setQuantity, removeItem, clear } = useCartStore();
  const [open, setOpen] = useState(initialOpen);
  const [quoteFormOpen, setQuoteFormOpen] = useState(false);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [quoteMessage, setQuoteMessage] = useState("");
  const [quoteMessageTone, setQuoteMessageTone] = useState<"success" | "error" | "neutral">("neutral");
  const [quoteStatusSteps, setQuoteStatusSteps] = useState<QuoteStatusStep[]>([]);
  const [quoteWhatsappHref, setQuoteWhatsappHref] = useState<string | null>(null);
  const hasAccountDefaults = Boolean(
    quoteDefaults?.name?.trim() || quoteDefaults?.phone?.trim() || quoteDefaults?.email?.trim(),
  );
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>(() => buildInitialQuoteDraft(settings, quoteDefaults));

  useEffect(() => {
    rehydrateCartStore();
  }, []);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(STORE_CART_OPEN_EVENT, handleOpen);

    return () => {
      window.removeEventListener(STORE_CART_OPEN_EVENT, handleOpen);
    };
  }, []);

  const visibleItems = hydrated ? items : [];
  const orderLines: CartLine[] = visibleItems.map((item) => ({
    item,
    pricing: getLinePricing(item, item.quantity),
  }));
  const totalAmount = orderLines.reduce((sum, line) => sum + line.pricing.total, 0);
  const totalSavings = orderLines.reduce((sum, line) => sum + line.pricing.savings, 0);

  const whatsappText = useMemo(
    () =>
      [
        settings.orderIntro,
        "",
        ...orderLines.map(({ item, pricing }) => {
          return `- ${item.name} (${item.code}) | ${pricing.quantityLabel} | ${pricing.tierLabel} | ${formatCurrency(pricing.total, settings.currencySymbol)}`;
        }),
        "",
        `Total referencial: ${formatCurrency(totalAmount, settings.currencySymbol)}`,
        settings.orderFooter,
      ].join("\n"),
    [orderLines, settings.currencySymbol, settings.orderFooter, settings.orderIntro, totalAmount],
  );

  const whatsappHref = buildPublicWhatsappHref(whatsappText);

  const updateQuoteDraft = (field: keyof QuoteDraft, value: string) => {
    setQuoteDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetQuoteDraft = () => {
    setQuoteDraft(buildInitialQuoteDraft(settings, quoteDefaults));
  };

  const submitQuoteToErp = async () => {
    if (!orderLines.length || quoteState === "loading") {
      return;
    }

    setQuoteState("loading");
    setQuoteMessage("");
    setQuoteMessageTone("neutral");
    setQuoteStatusSteps([]);
    setQuoteWhatsappHref(null);

    try {
      const response = await fetch("/api/erp-quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: {
            address: quoteDraft.address,
            documentNumber: quoteDraft.documentNumber,
            documentType: quoteDraft.documentType,
            email: quoteDraft.email,
            name: quoteDraft.name,
            phone: quoteDraft.phone,
          },
          items: orderLines.map(({ item }) => ({
            code: item.code,
            quantity: item.quantity,
          })),
          note: quoteDraft.note,
        }),
      });
      const payload = (await response.json()) as {
        message?: string;
        quoteNumber?: string | null;
        statusSteps?: QuoteStatusStep[];
        whatsappHref?: string | null;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo registrar la cotización.");
      }

      setQuoteState("success");
      setQuoteMessage(payload.message ?? "Solicitud enviada correctamente.");
      setQuoteMessageTone("success");
      setQuoteStatusSteps(payload.statusSteps ?? []);
      setQuoteWhatsappHref(payload.whatsappHref ?? null);
      setQuoteFormOpen(true);
    } catch (error) {
      setQuoteState("error");
      setQuoteMessage(
        error instanceof Error ? error.message : "No se pudo enviar la solicitud.",
      );
      setQuoteMessageTone("error");
      setQuoteStatusSteps([
        {
          status: "error",
          text:
            error instanceof Error ? error.message : "No se pudo enviar la solicitud.",
        },
      ]);
    }
  };

  if (!open && !orderLines.length) {
    return null;
  }

  return (
    <aside className={`cart-drawer ${open ? "is-open" : ""}`}>
      <CartHeader
        onClose={() => setOpen(false)}
        onToggleQuoteForm={() => setQuoteFormOpen((current) => !current)}
        quoteFormOpen={quoteFormOpen}
      />

      {orderLines.length ? (
        <>
          <CartList
            currencySymbol={settings.currencySymbol}
            onRemove={removeItem}
            onSetQuantity={setQuantity}
            orderLines={orderLines}
          />

          {quoteFormOpen ? (
            <QuoteForm
              draft={quoteDraft}
              hasAccountDefaults={hasAccountDefaults}
              onChange={updateQuoteDraft}
              onClose={() => setQuoteFormOpen(false)}
              onReset={resetQuoteDraft}
              onSubmit={() => void submitQuoteToErp()}
              quoteState={quoteState}
            />
          ) : null}

          <CartFooter
            currencySymbol={settings.currencySymbol}
            onClear={clear}
            onOpenQuoteForm={() => setQuoteFormOpen(true)}
            quoteState={quoteState}
            quoteMessage={quoteMessage}
            quoteMessageTone={quoteMessageTone}
            quoteStatusSteps={quoteStatusSteps}
            quoteWhatsappHref={quoteWhatsappHref}
            totalAmount={totalAmount}
            totalSavings={totalSavings}
            whatsappHref={whatsappHref}
          />
        </>
      ) : (
        <EmptyCartState />
      )}
    </aside>
  );
}
