export type SaleMode = "unit" | "box";

export type PriceableProduct = {
  name: string;
  code: string;
  unitLabel: string;
  unitPrice: number;
  wholesalePrice: number | null;
  wholesaleMinQty: number;
  boxPrice: number | null;
  unitsPerBox: number | null;
};

export function getUnitTier(product: PriceableProduct, quantity: number) {
  const wholesaleApplies =
    Boolean(product.wholesalePrice) && quantity >= product.wholesaleMinQty;

  return {
    unitPrice: wholesaleApplies ? product.wholesalePrice ?? product.unitPrice : product.unitPrice,
    tierLabel: wholesaleApplies ? "Mayorista" : "Unitario",
  };
}

export function getLinePricing(
  product: PriceableProduct,
  quantity: number,
) {
  const tier = getUnitTier(product, quantity);
  const referenceUnitPrice = product.unitPrice;
  const referenceTotal = referenceUnitPrice * quantity;
  const total = tier.unitPrice * quantity;

  return {
    tierLabel: tier.tierLabel,
    unitPrice: tier.unitPrice,
    total,
    savings: Math.max(0, referenceTotal - total),
    quantityLabel: `${quantity} ${product.unitLabel}${quantity > 1 ? "es" : ""}`,
  };
}
