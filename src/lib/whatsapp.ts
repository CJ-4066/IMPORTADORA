import { cleanWhatsappNumber } from "@/lib/utils";

type QuotePdfNotificationInput = {
  bodyText: string;
  fallbackText?: string | null;
  filename: string;
  pdfUrl: string;
  to: string;
};

export type WhatsappSendResult = {
  messageId: string | null;
  ok: boolean;
  provider: "meta-cloud";
  response: unknown;
};

export function getWhatsappAlertTarget(defaultNumber?: string | null) {
  const configured =
    process.env.WHATSAPP_ALERT_NUMBER?.trim() ||
    process.env.WHATSAPP_NOTIFICATION_NUMBER?.trim() ||
    defaultNumber?.trim() ||
    "";
  const cleaned = cleanWhatsappNumber(configured);
  return cleaned || null;
}

export function isWhatsappApiConfigured() {
  return Boolean(
    process.env.WHATSAPP_PROVIDER?.trim() === "meta-cloud" &&
      process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
  );
}

export async function sendQuotePdfToWhatsapp(
  input: QuotePdfNotificationInput,
): Promise<WhatsappSendResult> {
  const provider = process.env.WHATSAPP_PROVIDER?.trim();

  if (provider !== "meta-cloud") {
    throw new Error("No hay un proveedor de WhatsApp API soportado configurado.");
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!accessToken || !phoneNumberId) {
    throw new Error("Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID para enviar por WhatsApp API.");
  }

  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v22.0";
  const to = normalizeWhatsappRecipient(input.to);

  if (!to) {
    throw new Error("No hay un número destino válido para la alerta de WhatsApp.");
  }

  try {
    const documentResponse = await postMetaMessage(graphVersion, phoneNumberId, accessToken, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "document",
      document: {
        link: input.pdfUrl,
        caption: input.bodyText,
        filename: input.filename,
      },
    });

    return {
      messageId: getMetaMessageId(documentResponse),
      ok: true,
      provider: "meta-cloud",
      response: documentResponse,
    };
  } catch (error) {
    if (!input.fallbackText) {
      throw error;
    }

    const textResponse = await postMetaMessage(graphVersion, phoneNumberId, accessToken, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        body: input.fallbackText,
        preview_url: false,
      },
    });

    return {
      messageId: getMetaMessageId(textResponse),
      ok: true,
      provider: "meta-cloud",
      response: textResponse,
    };
  }
}

async function postMetaMessage(
  graphVersion: string,
  phoneNumberId: string,
  accessToken: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? extractMetaErrorMessage((payload as { error?: unknown }).error)
        : `WhatsApp API respondió HTTP ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

function extractMetaErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "No se pudo enviar el mensaje por WhatsApp API.";
  }

  const record = error as Record<string, unknown>;

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }

  return "No se pudo enviar el mensaje por WhatsApp API.";
}

function getMetaMessageId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const messages = (payload as { messages?: unknown }).messages;

  if (!Array.isArray(messages) || !messages.length) {
    return null;
  }

  const first = messages[0];

  if (!first || typeof first !== "object") {
    return null;
  }

  return typeof (first as { id?: unknown }).id === "string" ? (first as { id: string }).id : null;
}

function normalizeWhatsappRecipient(value: string) {
  const digits = cleanWhatsappNumber(value);

  if (!digits) {
    return null;
  }

  if (digits.startsWith("51") && digits.length >= 11) {
    return digits;
  }

  if (digits.length === 9) {
    return `51${digits}`;
  }

  return digits;
}
