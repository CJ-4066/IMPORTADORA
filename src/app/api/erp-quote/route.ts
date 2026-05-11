import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { FacturadorClient } from "@/lib/facturador/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  normalizeQuoteLineInputs,
  prepareQuoteLines,
  QuoteLineValidationError,
} from "@/lib/quote-pricing";
import { getStoreSettings } from "@/lib/store";
import { cleanWhatsappNumber, formatCurrency } from "@/lib/utils";
import {
  getWhatsappAlertTarget,
  isWhatsappApiConfigured,
  sendQuotePdfToWhatsapp,
} from "@/lib/whatsapp";

type QuoteRequestItem = {
  code: string;
  quantity: number;
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
  let localQuoteId: string | null = null;
  const session = await getSession();
  const shopper = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { phone: true },
      })
    : null;
  const payload = (await request.json()) as {
    items?: unknown;
    note?: string;
    customer?: QuoteCustomerPayload;
  };

  let requestedItems: QuoteRequestItem[];

  try {
    requestedItems = normalizeQuoteLineInputs(payload.items);
  } catch (error) {
    if (error instanceof QuoteLineValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    throw error;
  }

  if (!requestedItems.length) {
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
    const catalogProducts = await prisma.product.findMany({
      where: {
        code: {
          in: requestedItems.map((item) => item.code),
        },
      },
      select: {
        boxPrice: true,
        code: true,
        externalCode: true,
        externalId: true,
        id: true,
        isVisible: true,
        name: true,
        stockUnits: true,
        unitLabel: true,
        unitPrice: true,
        unitsPerBox: true,
        wholesaleMinQty: true,
        wholesalePrice: true,
      },
    });
    const items = prepareQuoteLines({
      requestedItems,
      products: catalogProducts.map((product) => ({
        ...product,
        boxPrice: product.boxPrice === null ? null : Number(product.boxPrice),
        unitPrice: Number(product.unitPrice),
        wholesalePrice:
          product.wholesalePrice === null ? null : Number(product.wholesalePrice),
      })),
    });
    const settings = await getStoreSettings();
    const note = payload.note ?? "Cotización generada desde la tienda virtual.";
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const localQuote = await prisma.quote.create({
      data: {
        currencySymbol: settings.currencySymbol,
        customerAddress,
        customerDocumentNumber: documentNumber,
        customerDocumentType: documentType,
        customerEmail,
        customerName,
        customerPhone,
        note,
        status: "PENDING",
        total,
        userId: session?.userId ?? null,
        items: {
          create: items.map((item) => ({
            code: item.code,
            externalId: item.externalId,
            name: item.name,
            productId: item.productId,
            quantity: item.quantity,
            tierLabel: item.tierLabel,
            total: item.total,
            unitPrice: item.unitPrice,
          })),
        },
      },
    });
    localQuoteId = localQuote.id;

    const client = new FacturadorClient();
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
      note,
    });
    const quoteNumber = getQuoteNumber(result.response);
    const quoteExternalId = getQuoteExternalId(result.response);
    const quotationRecord = await client.findQuotationRecord({
      externalId: quoteExternalId,
      quoteNumber,
    });
    const pdfUrl = getQuotationPdfUrl(quotationRecord, result.response);
    const pdfFilename = getQuotationPdfFilename(quotationRecord, quoteNumber);
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
    await prisma.quote.update({
      where: { id: localQuote.id },
      data: {
        erpCustomerId: result.customerId,
        erpCustomerMode: result.customerMode,
        erpExternalId: quoteExternalId,
        pdfNotification: toJson(pdfNotification),
        quoteNumber,
        status: "ERP_REGISTERED",
        statusSteps: toJson(statusSteps),
        whatsappHref,
      },
    });

    return NextResponse.json({
      customerMode: result.customerMode,
      localQuoteId: localQuote.id,
      message: [messageBase, customerModeLabel, pdfNotification.message, ...warnings].filter(Boolean).join(" "),
      pdfNotification,
      quoteNumber,
      response: result.response,
      statusSteps,
      whatsappHref,
      warnings,
    });
  } catch (error) {
    if (error instanceof QuoteLineValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (localQuoteId) {
      await prisma.quote
        .update({
          where: { id: localQuoteId },
          data: {
            errorMessage:
              error instanceof Error
                ? error.message
                : "No se pudo registrar la cotización en el ERP.",
            status: "ERROR",
          },
        })
        .catch(() => null);
    }

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

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
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
  items: PreparedCustomerWhatsappItem[];
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

type PreparedCustomerWhatsappItem = QuoteRequestItem & {
  name: string;
  unitPrice: number;
};
