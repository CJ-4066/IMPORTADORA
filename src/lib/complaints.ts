import type { ComplaintStatus, ComplaintType } from "@prisma/client";

type ComplaintContact = {
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  claimCode: string;
};

export function buildComplaintCode(date = new Date()) {
  const stamp = date.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `LR-${stamp}`;
}

export function normalizeComplaintPhone(phone: string | null | undefined) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.startsWith("51")) {
    return digits;
  }

  if (digits.length === 9) {
    return `51${digits}`;
  }

  return digits;
}

export function buildComplaintResponseText(input: {
  claimCode: string;
  customerName: string;
  subject: string;
  kind: ComplaintType | ComplaintStatus | string;
  responseText: string;
}) {
  const lines = [
    `Hola ${input.customerName},`,
    "",
    `Hemos registrado una respuesta para tu ${input.kind.toString().toLowerCase()}.`,
    `Código: ${input.claimCode}`,
    `Asunto: ${input.subject}`,
    "",
    input.responseText.trim(),
    "",
    "Saludos,",
    "Importaciones Super",
  ];

  return lines.join("\n");
}

export function buildComplaintEmailHref(
  contact: ComplaintContact,
  responseText: string,
  subject: string,
) {
  if (!contact.customerEmail) {
    return null;
  }

  const body = buildComplaintResponseText({
    claimCode: contact.claimCode,
    customerName: contact.customerName,
    kind: "reclamo",
    subject,
    responseText,
  });

  const params = new URLSearchParams({
    subject: `Respuesta Libro de Reclamaciones ${contact.claimCode}`,
    body,
  });

  return `mailto:${contact.customerEmail}?${params.toString()}`;
}

export function buildComplaintWhatsappHref(
  contact: ComplaintContact,
  responseText: string,
  subject: string,
) {
  const phone = normalizeComplaintPhone(contact.customerPhone);

  if (!phone) {
    return null;
  }

  const message = buildComplaintResponseText({
    claimCode: contact.claimCode,
    customerName: contact.customerName,
    kind: "reclamo",
    subject,
    responseText,
  });

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
