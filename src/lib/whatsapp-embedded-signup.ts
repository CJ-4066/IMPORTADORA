import { embeddedSignupSessionSchema, type EmbeddedSignupSession } from "@/lib/whatsapp-meta-schema";

const ALLOWED_META_ORIGINS = new Set([
  "https://www.facebook.com",
  "https://business.facebook.com",
  "https://web.facebook.com",
]);

type EmbeddedSignupEnvelope = {
  type?: unknown;
  event?: unknown;
  data?: unknown;
};

export type EmbeddedSignupBrowserResult =
  | { kind: "SESSION"; sessionInfo: EmbeddedSignupSession }
  | { kind: "CANCELLED"; message: string; sessionInfo: EmbeddedSignupSession | null }
  | { kind: "ERROR"; message: string; sessionInfo: EmbeddedSignupSession | null };

function parseEventData(data: unknown) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }

  return data;
}

function readEventName(envelope: EmbeddedSignupEnvelope, sessionInfo: EmbeddedSignupSession) {
  const event = typeof envelope.event === "string" ? envelope.event : sessionInfo.event;
  return event?.trim().toUpperCase() ?? "";
}

function readErrorMessage(sessionInfo: EmbeddedSignupSession) {
  return sessionInfo.error_message?.trim() || "Meta informó un error durante Embedded Signup.";
}

export function readEmbeddedSignupBrowserEvent(event: Pick<MessageEvent, "origin" | "data">): EmbeddedSignupBrowserResult | null {
  if (!ALLOWED_META_ORIGINS.has(event.origin)) {
    return null;
  }

  const raw = parseEventData(event.data);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const envelope = raw as EmbeddedSignupEnvelope;
  if (envelope.type !== "WA_EMBEDDED_SIGNUP" || !envelope.data || typeof envelope.data !== "object" || Array.isArray(envelope.data)) {
    return null;
  }

  const parsed = embeddedSignupSessionSchema.safeParse(envelope.data);
  if (!parsed.success) {
    return { kind: "ERROR", message: "Meta devolvió SessionInfo con formato inválido.", sessionInfo: null };
  }

  const eventName = readEventName(envelope, parsed.data);
  if (eventName === "CANCEL" || eventName === "CANCELLED") {
    return {
      kind: "CANCELLED",
      message: `Autorización cancelada en Meta${parsed.data.current_step ? ` durante ${parsed.data.current_step}` : ""}.`,
      sessionInfo: parsed.data,
    };
  }

  if (eventName === "ERROR") {
    return { kind: "ERROR", message: readErrorMessage(parsed.data), sessionInfo: parsed.data };
  }

  return { kind: "SESSION", sessionInfo: parsed.data };
}
