import { PackageCheck, Tags } from "lucide-react";
import type { CatalogProduct } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

export function getProductDiscountPercent(product: CatalogProduct) {
  return product.wholesalePrice && product.wholesalePrice < product.unitPrice
    ? Math.round(((product.unitPrice - product.wholesalePrice) / product.unitPrice) * 100)
    : 0;
}

export function getProductStockState(product: CatalogProduct) {
  const tone =
    product.stockUnits <= 0 ? "is-empty" : product.stockUnits <= 12 ? "is-low" : "is-ready";
  const label =
    product.stockUnits <= 0
      ? "Sin stock"
      : product.stockUnits <= 12
        ? `Stock bajo: ${product.stockUnits}`
        : `${product.stockUnits} disponibles`;

  return { label, tone };
}

export function ProductPriceRows({
  currencySymbol,
  product,
}: {
  currencySymbol: string;
  product: CatalogProduct;
}) {
  return (
    <>
      <div className="price-row">
        <span>
          <Tags size={16} />
          Unitario
        </span>
        <strong>{formatCurrency(product.unitPrice, currencySymbol)}</strong>
      </div>
      <div className="price-row">
        <span>Mayorista desde {product.wholesaleMinQty}</span>
        <strong>
          {product.wholesalePrice
            ? formatCurrency(product.wholesalePrice, currencySymbol)
            : "Mismo precio"}
        </strong>
      </div>
    </>
  );
}

export function ProductStockChip({ product }: { product: CatalogProduct }) {
  const stock = getProductStockState(product);

  return (
    <span className={`product-stock-chip ${stock.tone}`}>
      <PackageCheck size={13} />
      {stock.label}
    </span>
  );
}
