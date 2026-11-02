import { createHash } from "node:crypto";
import { z } from "zod";

export const channels = ["whatsapp", "telegram", "messenger", "instagram", "tiktok"] as const;
export const modes = ["OFF", "COPILOT", "HYBRID", "AUTO"] as const;
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
    location: z.string().max(600), payment: z.string().max(600), returns: z.string().max(600),
  }),
});
export type Policies = z.infer<typeof settingsSchema>["policies"];
export type ProductFact = { id: string; name: string; code: string; price: number; stock: number; wholesalePrice: number | null; wholesaleMinQty: number };
export const decisionSchema = z.object({
  intent: z.enum(["greeting", "product", "policy", "clarify", "handoff"]),
  productIds: z.array(z.string()).max(3),
  quantity: z.number().int().min(1).max(10000),
  policyKey: z.enum(["hours", "shipping", "location", "payment", "returns", "none"]),
  reason: z.enum(["routine", "ambiguous", "human_requested", "complaint", "negotiation", "unsupported"]),
});
export type Decision = z.infer<typeof decisionSchema>;
export type HistoryItem = { id: string; role: "user" | "assistant"; text: string; at: string; attachment?: boolean };
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
    .replace(/(?<!\w)(?:\+?\d[\s()-]*){9,16}(?!\w)/g, "[teléfono o documento]");
}
export function needsHuman(text: string) {
  return /\b(asesor[a]?|humano|persona|reclamo|estafa|devolucion|reembolso|denuncia|descuento|negociar|comprobante|ya pague)\b/i.test(text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}
export function renderDecision(decision: Decision, products: ProductFact[], policies: Policies) {
  const selected = decision.productIds.map(id => products.find(p => p.id === id));
  if (decision.reason !== "routine" || decision.intent === "handoff") {
    return { text: "Un asesor revisará tu consulta y te atenderá por este mismo chat.", safe: false, reason: decision.reason };
  }
  if (decision.intent === "greeting") return { text: "¡Hola! Soy Super Bot, el asistente de Importaciones Super. ¿Qué producto buscas y cuántas unidades necesitas?", safe: true, reason: "greeting" };
  if (decision.intent === "policy" && decision.policyKey !== "none" && policies[decision.policyKey]?.trim()) {
    return { text: policies[decision.policyKey].trim(), safe: true, reason: "verified_policy" };
  }
  if (decision.intent === "product" && selected.length && selected.every(p => p && p.stock >= decision.quantity && p.price > 0)) {
    const text = (selected as ProductFact[]).map(p => {
      const price = p.wholesalePrice && p.wholesalePrice > 0 && decision.quantity >= p.wholesaleMinQty ? p.wholesalePrice : p.price;
      return `${p.name} (${p.code}): S/ ${price.toFixed(2)} por unidad. ${decision.quantity} unidad(es): S/ ${(Math.round(price * decision.quantity * 100) / 100).toFixed(2)}. Disponibilidad consultada: ${p.stock} unidades.`;
    }).join("\n");
    const reply = `${text}\nEl stock está sujeto a confirmación al realizar el pedido.`;
    if (reply.length > 1000) return { text: "Un asesor te ayudará a preparar la cotización detallada.", safe: false, reason: "response_limit" };
    return { text: reply, safe: true, reason: "verified_catalog" };
  }
  return { text: "¿Me indicas el nombre o modelo exacto del producto y la cantidad que necesitas? Un asesor puede ayudarte si no lo identificamos.", safe: false, reason: "needs_clarification" };
}
export function automaticAllowed(mode: AiMode, decision: Decision, safe: boolean) {
  if (!safe) return false;
  // Hybrid only handles policy information and unambiguous single-unit quotes.
  return mode === "AUTO" || mode === "HYBRID" && (
    decision.intent === "greeting" || decision.intent === "policy" && decision.policyKey !== "returns" && decision.policyKey !== "payment" ||
    decision.intent === "product" && decision.productIds.length === 1 && decision.quantity === 1
  );
}
export function currentDraft(draft: { contextHash: string; controlRevision: number; settingsRevision: number; expiresAt: Date }, snapshot: Snapshot, revision: number, settingsRevision: number, now = Date.now()) {
  return snapshot.owned && snapshot.canSend && draft.contextHash === snapshot.contextHash &&
    draft.controlRevision === revision && draft.settingsRevision === settingsRevision && draft.expiresAt.getTime() > now;
}
