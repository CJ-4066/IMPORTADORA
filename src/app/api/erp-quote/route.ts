import { NextResponse } from "next/server";
import { FacturadorClient } from "@/lib/facturador/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/store";
import { cleanWhatsappNumber, formatCurrency } from "@/lib/utils";
import {
  getWhatsappAlertTarget,
  isWhatsappApiConfigured,
  sendQuotePdfToWhatsapp,
} from "@/lib/whatsapp";

type QuoteRequestItem = {
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type QuoteCustomerPayload = {
  name?: string;
  phone?: string;
  email?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  address?: string | null;
};

export async function POST(request: Request) {
  const session = await getSession();
  const shopper = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { phone: true },
      })
    : null;
  const payload = (await request.json()) as {
    items?: QuoteRequestItem[];
    note?: string;
    customer?: QuoteCustomerPayload;
  };

  const items = (payload.items ?? []).filter(
    (item) =>
      item &&
      typeof item.code === "string" &&
      typeof item.name === "string" &&
      typeof item.quantity === "number" &&
      typeof item.unitPrice === "number",
  );

  if (!items.length) {
    return NextResponse.json({ message: "No hay items para cotizar." }, { status: 400 });
  }

  const customerName = payload.customer?.name?.trim() || session?.name?.trim() || "";
  const customerPhone = payload.customer?.phone?.trim() || shopper?.phone?.trim() || "";
  const customerEmail = payload.customer?.email?.trim() || session?.email?.trim() || null;
  const documentType = payload.customer?.documentType?.trim() || null;
  const documentNumber = payload.customer?.documentNumber?.trim() || null;
  const customerAddress = payload.customer?.address?.trim() || null;

  if (customerName.length < 3) {
    return NextResponse.json(
      { message: "Ingresa el nombre o razón social del cliente para registrar la cotización." },
      { status: 400 },
    );
  }

  if (customerPhone.length < 6) {
    return NextResponse.json(
      { message: "Ingresa un teléfono de contacto válido para registrar la cotización." },
      { status: 400 },
    );
  }

  if (Boolean(documentType) !== Boolean(documentNumber)) {
    return NextResponse.json(
      { message: "Si ingresas documento, completa también el tipo y el número." },
      { status: 400 },
    );
  }

  try {
    const client = new FacturadorClient();
    const settings = await getStoreSettings();
    const result = await client.createQuotation({
      customer: {
        address: customerAddress,
        documentNumber,
        documentType,
        email: customerEmail,
        name: customerName,
        phone: customerPhone,
      },
      items,
      note: payload.note ?? "Cotización generada desde la tienda virtual.",
    });
    const quoteNumber = getQuoteNumber(result.response);
    const quoteExternalId = getQuoteExternalId(result.response);
    const quotationRecord = await client.findQuotationRecord({
      externalId: quoteExternalId,
      quoteNumber,
    });
    const pdfUrl = getQuotationPdfUrl(quotationRecord, result.response);
    const pdfFilename = getQuotationPdfFilename(quotationRecord, quoteNumber);
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const whatsappHref = buildCustomerWhatsappHref({
      businessName: settings.businessName,
      currencySymbol: settings.currencySymbol,
      customerName,
      phone: customerPhone,
      quoteNumber,
      total,
      items,
    });
    const warnings = result.warnings.filter(Boolean);
    const internalWhatsappNumber = getWhatsappAlertTarget(settings.whatsappNumber);
    const pdfNotification = await sendInternalPdfNotification({
      businessName: settings.businessName,
      customerName,
      currencySymbol: settings.currencySymbol,
      pdfFilename,
      pdfUrl,
      quoteNumber,
      recipientNumber: internalWhatsappNumber,
      total,
    });
    const messageBase = quoteNumber
      ? `Cotización ${quoteNumber} registrada en el ERP.`
      : "Cotización registrada en el ERP.";
    const customerModeLabel =
      result.customerMode === "created"
        ? "Cliente creado en ERP."
        : result.customerMode === "existing"
          ? "Cliente vinculado al registro existente."
          : "Se usó el cliente genérico del ERP.";
    const statusSteps = [
      {
        status: "success",
        text: messageBase,
      },
      {
        status: result.customerMode === "default" ? "warning" : "success",
        text: customerModeLabel,
      },
      {
        status: pdfNotification.sent ? "success" : "warning",
        text: pdfNotification.message,
      },
      ...warnings.map((warning) => ({
        status: "warning" as const,
        text: warning,
      })),
    ];

    return NextResponse.json({
      customerMode: result.customerMode,
      message: [messageBase, customerModeLabel, pdfNotification.message, ...warnings].filter(Boolean).join(" "),
      pdfNotification,
      quoteNumber,
      response: result.response,
      statusSteps,
      whatsappHref,
      warnings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "No se pudo registrar la cotización en el ERP.",
      },
      { status: 500 },
    );
  }
}

function getQuoteNumber(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;

  for (const candidate of [record.number_full, record.number, record.identifier]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (record.data && typeof record.data === "object") {
    return getQuoteNumber(record.data);
  }

  return null;
}

function getQuoteExternalId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;

  for (const candidate of [record.external_id, record.externalId]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (record.data && typeof record.data === "object") {
    return getQuoteExternalId(record.data);
  }

  return null;
}

function getQuotationPdfUrl(record: unknown, payload: unknown) {
  return getFirstStringFromUnknown(record, ["print_a4"]) ?? getFirstStringFromUnknown(payload, ["print_a4"]);
}

function getQuotationPdfFilename(record: unknown, quoteNumber: string | null) {
  const filename = getFirstStringFromUnknown(record, ["filename"]);

  if (filename) {
    return filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  }

  return quoteNumber ? `${quoteNumber}.pdf` : "cotizacion.pdf";
}

async function sendInternalPdfNotification(input: {
  businessName: string;
  customerName: string;
  currencySymbol: string;
  pdfFilename: string;
  pdfUrl: string | null;
  quoteNumber: string | null;
  recipientNumber: string | null;
  total: number;
}) {
  if (!input.pdfUrl) {
    return {
      message: "El ERP no devolvió un PDF imprimible para enviar por WhatsApp.",
      ok: false,
      sent: false,
    };
  }

  if (!input.recipientNumber) {
    return {
      message: "Falta configurar el número destino de alerta para WhatsApp.",
      ok: false,
      sent: false,
    };
  }

  if (!isWhatsappApiConfigured()) {
    return {
      message: "La cotización quedó registrada, pero falta configurar la WhatsApp API para enviar el PDF automáticamente.",
      ok: false,
      sent: false,
    };
  }

  const summary = [
    input.quoteNumber
      ? `Cotización ${input.quoteNumber} registrada en ${input.businessName}.`
      : `Cotización registrada en ${input.businessName}.`,
    `Cliente: ${input.customerName}`,
    `Total referencial: ${formatCurrency(input.total, input.currencySymbol)}`,
  ].join("\n");
  const fallbackText = `${summary}\nPDF: ${input.pdfUrl}`;

  try {
    const result = await sendQuotePdfToWhatsapp({
      bodyText: summary,
      fallbackText,
      filename: input.pdfFilename,
      pdfUrl: input.pdfUrl,
      to: input.recipientNumber,
    });

    return {
      message: "PDF enviado automáticamente por WhatsApp API.",
      messageId: result.messageId,
      ok: true,
      provider: result.provider,
      sent: true,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? `No se pudo enviar el PDF por WhatsApp API: ${error.message}`
          : "No se pudo enviar el PDF por WhatsApp API.",
      ok: false,
      sent: false,
    };
  }
}

function normalizeCustomerWhatsappNumber(value: string) {
  const digits = cleanWhatsappNumber(value);

  if (digits.startsWith("51") && digits.length >= 11) {
    return digits;
  }

  if (digits.length === 9) {
    return `51${digits}`;
  }

  return digits;
}

function getFirstStringFromUnknown(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const candidate = record[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (record.data && typeof record.data === "object") {
    return getFirstStringFromUnknown(record.data, keys);
  }

  return null;
}

function buildCustomerWhatsappHref(input: {
  businessName: string;
  currencySymbol: string;
  customerName: string;
  phone: string;
  quoteNumber: string | null;
  total: number;
  items: QuoteRequestItem[];
}) {
  const phone = normalizeCustomerWhatsappNumber(input.phone);

  if (!phone || phone.length < 11) {
    return null;
  }

  const text = [
    `Hola ${input.customerName},`,
    input.quoteNumber
      ? `tu cotización ${input.quoteNumber} ya fue registrada en ${input.businessName}.`
      : `tu cotización ya fue registrada en ${input.businessName}.`,
    "",
    ...input.items.map(
      (item) =>
        `- ${item.name} (${item.code}) x${item.quantity} · ${formatCurrency(item.unitPrice * item.quantity, input.currencySymbol)}`,
    ),
    "",
    `Total referencial: ${formatCurrency(input.total, input.currencySymbol)}`,
  ].join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
