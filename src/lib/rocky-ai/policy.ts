import { createHash } from "node:crypto";
import { z } from "zod";

export const channels = ["whatsapp", "telegram", "messenger", "instagram", "tiktok"] as const;
export const modes = ["OFF", "COPILOT", "HYBRID", "AUTO"] as const;
export const defaultPricingPolicy = "Trabajamos con precios publicados por unidad y por mayor según la cantidad indicada. No aplicamos descuentos adicionales. La presentación por cajón se cotiza sólo cuando la solicites y esté disponible.";
export type AiChannel = typeof channels[number];
export type AiMode = typeof modes[number];
export const targetSchema = z.object({ channel: z.enum(channels), externalId: z.string().min(1).max(180).regex(/^[a-zA-Z0-9:_-]+$/) });
export const settingsSchema = z.object({
  enabled: z.boolean(),
  model: z.string().regex(/^[a-zA-Z0-9._-]+$/).max(80),
  dailyRequests: z.number().int().min(1).max(10000),
  dailyTokens: z.number().int().min(10000).max(10000000),
  maxOutputTokens: z.number().int().min(300).max(1500),
  channelDefaults: z.object({
    whatsapp: z.enum(modes).default("OFF"), telegram: z.enum(modes).default("OFF"),
    messenger: z.enum(modes).default("OFF"), instagram: z.enum(modes).default("OFF"), tiktok: z.enum(modes).default("OFF"),
  }),
  policies: z.object({
    hours: z.string().max(600), shipping: z.string().max(600),
    location: z.string().max(600), payment: z.string().max(1200), returns: z.string().max(600), pricing: z.string().max(600).default(defaultPricingPolicy),
  }),
});
export type Policies = z.infer<typeof settingsSchema>["policies"];
export type ProductFact = { id: string; name: string; code: string; price: number; stock: number; wholesalePrice: number | null; wholesaleMinQty: number; boxPrice?: number | null; unitsPerBox?: number | null };
export const decisionSchema = z.object({
  intent: z.enum(["greeting", "product", "policy", "clarify", "handoff"]),
  productIds: z.array(z.string()).max(3),
  quantity: z.number().int().min(1).max(10000),
  // Strict Structured Outputs requires every property to be present. `null`
  // explicitly means the regular unit/wholesale pricing flow applies.
  priceMode: z.enum(["UNIT", "BOX"]).nullable(),
  policyKey: z.enum(["hours", "shipping", "location", "payment", "returns", "pricing", "none"]),
  reason: z.enum(["routine", "ambiguous", "human_requested", "complaint", "negotiation", "unsupported"]),
});
export type Decision = z.infer<typeof decisionSchema>;
export type HistoryItem = { id: string; role: "user" | "assistant"; text: string; at: string; attachment?: boolean };
export const simulationHistorySchema = z.array(z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(600),
})).min(1).max(12);
export type Snapshot = { triggerId: string; contextHash: string; history: HistoryItem[]; owned: boolean; canSend: boolean; reason?: string };
export function targetKey(channel: AiChannel, externalId: string) { return `${channel}:${externalId}`; }
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex"); }
export function maskPersonalData(text: string) {
  return text.replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "[correo]")
    // Covers phone numbers, documents and Peruvian CCI/account formats, even
    // when they contain separators. Product codes remain outside this pattern.
    .replace(/(?<!\w)(?:\+?\d[\s()-]*){9,30}(?!\w)/g, "[teléfono o documento]");
}
export function needsHuman(text: string) {
  return /\b(asesor[a]?|humano|persona|reclamo|estafa|devolucion|reembolso|denuncia|comprobante|ya pague)\b/i.test(text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}
export function renderDecision(decision: Decision, products: ProductFact[], policies: Policies) {
  const selected = decision.productIds.map(id => products.find(p => p.id === id));
  if (decision.intent === "policy" && decision.policyKey === "pricing") {
    return { text: policies.pricing.trim() || defaultPricingPolicy, safe: true, reason: "verified_policy" };
  }
  if (decision.reason !== "routine" || decision.intent === "handoff") {
    return { text: "Un asesor revisará tu consulta y te atenderá por este mismo chat.", safe: false, reason: decision.reason };
  }
  if (decision.intent === "greeting") return { text: "¡Hola! Soy Super Bot, el asistente de Importaciones Super. ¿Qué producto buscas y cuántas unidades necesitas?", safe: true, reason: "greeting" };
  if (decision.intent === "policy" && decision.policyKey !== "none") {
    const policy = policies[decision.policyKey]?.trim();
    if (policy) return { text: policy, safe: true, reason: "verified_policy" };
  }
  if (decision.intent === "product" && selected.length && selected.every((product): product is ProductFact => product != null)) {
    const selectedProducts = selected;
    if (decision.priceMode === "BOX") {
      const validBoxQuote = selectedProducts.every(p => p.boxPrice != null && Number.isFinite(p.boxPrice) && p.boxPrice > 0 && p.unitsPerBox != null && Number.isInteger(p.unitsPerBox) && p.unitsPerBox > 0 && p.stock >= decision.quantity * p.unitsPerBox);
      if (!validBoxQuote) return { text: "La presentación por cajón se confirma con un asesor antes de cotizarla.", safe: false, reason: "needs_clarification" };
      const text = selectedProducts.map(p => {
        const total = Math.round(p.boxPrice! * decision.quantity * 100) / 100;
        return `${p.name} (${p.code}): S/ ${p.boxPrice!.toFixed(2)} por cajón (${p.unitsPerBox} unidades). ${decision.quantity} cajón(es): S/ ${total.toFixed(2)}.`;
      }).join("\n");
      const reply = `${text}\nLa disponibilidad se confirma al realizar el pedido.`;
      return reply.length > 1000 ? { text: "Un asesor te ayudará a preparar la cotización detallada.", safe: false, reason: "response_limit" } : { text: reply, safe: true, reason: "verified_catalog" };
    }
    if (selectedProducts.every(p => p.stock >= decision.quantity && p.price > 0)) {
      const text = selectedProducts.map(p => {
        const price = p.wholesalePrice && p.wholesalePrice > 0 && decision.quantity >= p.wholesaleMinQty ? p.wholesalePrice : p.price;
        // Inventory is checked on the server to prevent overselling, but its
        // quantity is internal operational data and must never reach a client.
        return `${p.name} (${p.code}): S/ ${price.toFixed(2)} por unidad. ${decision.quantity} unidad(es): S/ ${(Math.round(price * decision.quantity * 100) / 100).toFixed(2)}.`;
      }).join("\n");
      const reply = `${text}\nLa disponibilidad se confirma al realizar el pedido.`;
      if (reply.length > 1000) return { text: "Un asesor te ayudará a preparar la cotización detallada.", safe: false, reason: "response_limit" };
      return { text: reply, safe: true, reason: "verified_catalog" };
    }
  }
  return { text: "¿Me indicas el nombre o modelo exacto del producto y la cantidad que necesitas? Un asesor puede ayudarte si no lo identificamos.", safe: false, reason: "needs_clarification" };
}
export function automaticAllowed(mode: AiMode, decision: Decision, safe: boolean) {
  if (!safe) return false;
  // Hybrid only handles policy information and unambiguous single-unit quotes.
  return mode === "AUTO" || mode === "HYBRID" && (
    decision.intent === "greeting" || decision.intent === "policy" && decision.policyKey !== "returns" && decision.policyKey !== "payment" ||
    decision.intent === "product" && decision.priceMode !== "BOX" && decision.productIds.length === 1 && decision.quantity === 1
  );
}
export function currentDraft(draft: { contextHash: string; controlRevision: number; settingsRevision: number; expiresAt: Date }, snapshot: Snapshot, revision: number, settingsRevision: number, now = Date.now()) {
  return snapshot.owned && snapshot.canSend && draft.contextHash === snapshot.contextHash &&
    draft.controlRevision === revision && draft.settingsRevision === settingsRevision && draft.expiresAt.getTime() > now;
}
