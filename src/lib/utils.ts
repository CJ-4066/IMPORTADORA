import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatCurrency(value: number, currencySymbol = "S/") {
  return `${currencySymbol} ${value.toFixed(2)}`;
}

export function formatRepeatedPriceRow(
  price: number,
  currencySymbol = "S/",
  qtyLabel?: string,
) {
  const formattedPrice = formatCurrency(price, currencySymbol);

  return qtyLabel ? `${qtyLabel} ${formattedPrice}` : formattedPrice;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("es-PE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function cleanWhatsappNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

export const PUBLIC_WHATSAPP_NUMBER = "51955252609";

export function normalizeWhatsappPhone(phone: string | null | undefined) {
  const digits = phone ? cleanWhatsappNumber(phone) : "";

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

export function buildWhatsappHrefFromPhone(phone: string | null | undefined, text?: string) {
  const normalizedPhone = normalizeWhatsappPhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  const base = `https://wa.me/${normalizedPhone}`;

  if (!text) {
    return base;
  }

  return `${base}?text=${encodeURIComponent(text)}`;
}

export function buildPublicWhatsappHref(text?: string) {
  const base = `https://wa.me/${PUBLIC_WHATSAPP_NUMBER}`;

  if (!text) {
    return base;
  }

  return `${base}?text=${encodeURIComponent(text)}`;
}

export function isTruthy(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}
