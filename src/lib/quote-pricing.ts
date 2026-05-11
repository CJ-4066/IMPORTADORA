import { getLinePricing, type PriceableProduct } from "@/lib/pricing";

const MAX_QUOTE_LINES = 80;
const MAX_QUOTE_QUANTITY = 100_000;

export class QuoteLineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteLineValidationError";
  }
}

export type QuoteLineInput = {
  code: string;
  quantity: number;
};

export type QuoteLineProduct = PriceableProduct & {
  code: string;
  externalCode: string | null;
  externalId: string | null;
  id: string;
  isVisible: boolean;
  stockUnits: number;
};

export type PreparedQuoteLine = {
  code: string;
  externalId: string | null;
  name: string;
  productId: string;
  quantity: number;
  tierLabel: string;
  total: number;
  unitPrice: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseQuantity(value: unknown) {
  const quantity = Number(value);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new QuoteLineValidationError("Cada producto debe tener una cantidad entera mayor a cero.");
  }

  if (quantity > MAX_QUOTE_QUANTITY) {
    throw new QuoteLineValidationError("La cantidad solicitada es demasiado alta para una cotización.");
  }

  return quantity;
}

export function normalizeQuoteLineInputs(value: unknown): QuoteLineInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  if (value.length > MAX_QUOTE_LINES) {
    throw new QuoteLineValidationError(`Puedes cotizar hasta ${MAX_QUOTE_LINES} líneas por pedido.`);
  }

  const merged = new Map<string, QuoteLineInput>();

  for (const item of value) {
    if (!isRecord(item)) {
      throw new QuoteLineValidationError("Hay un producto inválido en la cotización.");
    }

    const code = typeof item.code === "string" ? item.code.trim() : "";

    if (!code) {
      throw new QuoteLineValidationError("Hay un producto sin código en la cotización.");
    }

    const quantity = parseQuantity(item.quantity);
    const key = code.toLowerCase();
    const current = merged.get(key);
    const nextQuantity = (current?.quantity ?? 0) + quantity;

    if (nextQuantity > MAX_QUOTE_QUANTITY) {
      throw new QuoteLineValidationError("La cantidad solicitada es demasiado alta para una cotización.");
    }

    merged.set(key, {
      code: current?.code ?? code,
      quantity: nextQuantity,
    });
  }

  return Array.from(merged.values());
}

export function prepareQuoteLines(input: {
  products: QuoteLineProduct[];
  requestedItems: QuoteLineInput[];
}): PreparedQuoteLine[] {
  const productsByCode = new Map(
    input.products.map((product) => [product.code.toLowerCase(), product]),
  );

  return input.requestedItems.map((item) => {
    const product = productsByCode.get(item.code.toLowerCase());

    if (!product) {
      throw new QuoteLineValidationError(`No se encontró el producto ${item.code} en el catálogo.`);
    }

    if (!product.isVisible) {
      throw new QuoteLineValidationError(`El producto ${product.code} no está disponible para cotizar.`);
    }

    if (product.stockUnits <= 0) {
      throw new QuoteLineValidationError(`El producto ${product.code} no tiene stock disponible.`);
    }

    if (item.quantity > product.stockUnits) {
      throw new QuoteLineValidationError(
        `Solo hay ${product.stockUnits} unidades disponibles de ${product.code}.`,
      );
    }

    const pricing = getLinePricing(product, item.quantity);

    if (pricing.unitPrice <= 0) {
      throw new QuoteLineValidationError(`El producto ${product.code} no tiene un precio válido.`);
    }

    return {
      code: product.code,
      externalId: product.externalCode ?? product.externalId,
      name: product.name,
      productId: product.id,
      quantity: item.quantity,
      tierLabel: pricing.tierLabel,
      total: pricing.total,
      unitPrice: pricing.unitPrice,
    };
  });
}
