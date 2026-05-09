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

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("es-PE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function cleanWhatsappNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function isTruthy(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}
