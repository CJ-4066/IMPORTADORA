import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeQuoteLineInputs,
  prepareQuoteLines,
  QuoteLineValidationError,
  type QuoteLineProduct,
} from "@/lib/quote-pricing";

const products: QuoteLineProduct[] = [
  {
    boxPrice: null,
    code: "SKU-100",
    externalCode: null,
    externalId: "erp-100",
    id: "product-100",
    isVisible: true,
    name: "Producto mayorista",
    stockUnits: 20,
    unitLabel: "unidad",
    unitPrice: 10,
    unitsPerBox: null,
    wholesaleMinQty: 6,
    wholesalePrice: 8,
  },
  {
    boxPrice: null,
    code: "SKU-200",
    externalCode: null,
    externalId: null,
    id: "product-200",
    isVisible: false,
    name: "Producto oculto",
    stockUnits: 10,
    unitLabel: "unidad",
    unitPrice: 12,
    unitsPerBox: null,
    wholesaleMinQty: 3,
    wholesalePrice: null,
  },
];

test("normaliza y consolida líneas por código", () => {
  const lines = normalizeQuoteLineInputs([
    { code: "SKU-100", quantity: 2 },
    { code: "sku-100", quantity: 3 },
  ]);

  assert.deepEqual(lines, [{ code: "SKU-100", quantity: 5 }]);
});

test("recalcula precio mayorista desde productos del servidor", () => {
  const lines = prepareQuoteLines({
    products,
    requestedItems: [{ code: "SKU-100", quantity: 6 }],
  });

  assert.equal(lines[0].unitPrice, 8);
  assert.equal(lines[0].total, 48);
  assert.equal(lines[0].tierLabel, "Mayorista");
  assert.equal(lines[0].externalId, "erp-100");
});

test("rechaza productos ocultos o sin stock suficiente", () => {
  assert.throws(
    () =>
      prepareQuoteLines({
        products,
        requestedItems: [{ code: "SKU-200", quantity: 1 }],
      }),
    QuoteLineValidationError,
  );

  assert.throws(
    () =>
      prepareQuoteLines({
        products,
        requestedItems: [{ code: "SKU-100", quantity: 21 }],
      }),
    /Solo hay 20 unidades/,
  );
});

test("rechaza cantidades inválidas", () => {
  assert.throws(
    () => normalizeQuoteLineInputs([{ code: "SKU-100", quantity: 1.5 }]),
    QuoteLineValidationError,
  );
});
