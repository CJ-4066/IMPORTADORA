"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Clock3, ImageIcon, ShoppingCart } from "lucide-react";
import { STORE_CART_OPEN_EVENT } from "@/components/catalog/cart-events";
import { isCartStoreHydrated, rehydrateCartStore, useCartStore } from "@/components/catalog/cart-store";
import type { CatalogProduct, StoreSettingsView } from "@/lib/store";
import {
  getProductDiscountPercent,
  ProductPriceRows,
  ProductStockChip,
} from "@/components/catalog/product-display";

type ProductCardProps = {
  product: CatalogProduct;
  settings: StoreSettingsView;
};

export function ProductCard({ product, settings }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const primaryMedia = product.primaryMedia;
  const [imageFailed, setImageFailed] = useState(false);
  const shouldShowMedia = primaryMedia && !(primaryMedia.type === "IMAGE" && imageFailed);
  const discountPercent = getProductDiscountPercent(product);
  const lastSyncedLabel = product.lastSyncedAt
    ? new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(
        new Date(product.lastSyncedAt),
      )
    : null;

  const handleAddToCart = async () => {
    if (!isCartStoreHydrated()) {
      await rehydrateCartStore();
    }

    addItem(product, "unit");
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(STORE_CART_OPEN_EVENT));
    });
  };

  return (
    <article className="product-card">
      <div className="product-media">
        {primaryMedia && shouldShowMedia ? (
          <Link aria-label={`Ver detalle de ${product.name}`} className="product-media-link" href={`/producto/${product.slug}`}>
            <div className="product-media-preview">
              {primaryMedia.type === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={primaryMedia.altText ?? product.name}
                  onError={() => setImageFailed(true)}
                  src={primaryMedia.url}
                />
              ) : (
                <video muted playsInline preload="metadata" src={primaryMedia.url} />
              )}
            </div>
          </Link>
        ) : (
          <Link aria-label={`Ver detalle de ${product.name}`} className="product-media-link" href={`/producto/${product.slug}`}>
            <div className="product-media-preview product-media-placeholder">
              <ImageIcon size={28} />
              <strong>{product.category ?? "Catálogo"}</strong>
              <span>{product.name}</span>
            </div>
          </Link>
        )}
        <div className="product-media-meta">
          <span className="product-code">{product.code}</span>
          <ProductStockChip product={product} />
          {product.isFeatured ? (
            <span className="pill pill-accent">
              Oferta{discountPercent ? ` -${discountPercent}%` : ""}
            </span>
          ) : null}
        </div>
      </div>

      <div className="product-body">
        <div className="stack-sm product-copy-shell">
          <div className="product-heading-row">
            {product.category ? <span className="product-category-mini">{product.category}</span> : <span />}
            <Link className="product-open-link" href={`/producto/${product.slug}`}>
              <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="stack-xs product-copy">
            <h3>
              <Link className="product-title-link" href={`/producto/${product.slug}`}>
                {product.name}
              </Link>
            </h3>
            <p className="muted">
              {product.brand ? product.brand : "Compra por unidad o volumen"}
            </p>
            <div className="product-card-facts">
              {product.syncEnabled ? (
                <span>
                  <Clock3 size={13} />
                  ERP{lastSyncedLabel ? ` ${lastSyncedLabel}` : ""}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="price-box product-price-box">
          <ProductPriceRows currencySymbol={settings.currencySymbol} product={product} />
        </div>

        <div className="product-actions product-actions-single">
          <button
            className="button button-primary"
            disabled={product.stockUnits <= 0}
            onClick={() => void handleAddToCart()}
            type="button"
          >
            <ShoppingCart size={16} />
            {product.stockUnits <= 0 ? "Sin stock" : "Añadir al carrito"}
          </button>
        </div>
      </div>
    </article>
  );
}
