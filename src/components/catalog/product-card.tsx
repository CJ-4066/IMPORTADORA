"use client";

import Link from "next/link";
import { useState } from "react";
import { ImageIcon, Minus, MessageCircle, Plus, ShoppingCart } from "lucide-react";
import { STORE_CART_OPEN_EVENT } from "@/components/catalog/cart-events";
import { isCartStoreHydrated, rehydrateCartStore, useCartStore } from "@/components/catalog/cart-store";
import { getSafeMediaUrl } from "@/lib/media-url";
import { getPublicProductName } from "@/lib/product-name";
import type { CatalogProduct, StoreSettingsView } from "@/lib/store";
import { buildPublicWhatsappHref } from "@/lib/utils";
import { ProductPriceRows } from "@/components/catalog/product-display";

type ProductCardProps = {
  product: CatalogProduct;
  settings: StoreSettingsView;
};

export function ProductCard({ product, settings }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const primaryMedia = product.primaryMedia;
  const primaryMediaUrl = getSafeMediaUrl(primaryMedia?.url);
  const displayName = getPublicProductName(product.name);
  const [imageFailed, setImageFailed] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const shouldShowMedia = primaryMedia && primaryMediaUrl && !(primaryMedia.type === "IMAGE" && imageFailed);
  const whatsappHref = buildPublicWhatsappHref(`Hola, quiero consultar por el producto ${displayName}.`);
  const handleAddToCart = async () => {
    if (!isCartStoreHydrated()) {
      await rehydrateCartStore();
    }

    addItem(product, "unit", quantity);
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(STORE_CART_OPEN_EVENT));
    });
    setQuantity(1);
  };

  return (
    <article className="product-card">
      <div className="product-media">
        {primaryMedia && shouldShowMedia ? (
          <Link aria-label={`Ver detalle de ${displayName}`} className="product-media-link" href={`/producto/${product.slug}`}>
            <div className="product-media-preview">
              {primaryMedia.type === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={primaryMedia.altText ?? displayName}
                  decoding="async"
                  loading="lazy"
                  onError={() => setImageFailed(true)}
                  referrerPolicy="no-referrer"
                  src={primaryMediaUrl}
                />
              ) : (
                <video muted playsInline preload="metadata" src={primaryMediaUrl} />
              )}
            </div>
          </Link>
        ) : (
          <Link aria-label={`Ver detalle de ${displayName}`} className="product-media-link" href={`/producto/${product.slug}`}>
            <div className="product-media-preview product-media-placeholder">
              <ImageIcon size={28} />
              <strong>{product.category ?? "Catálogo"}</strong>
              <span>{displayName}</span>
            </div>
          </Link>
        )}
      </div>

      <div className="product-body">
        <div className="stack-sm product-copy-shell">
          <div className="stack-xs product-copy">
            <h3>
              <Link className="product-title-link" href={`/producto/${product.slug}`}>
                {displayName}
              </Link>
            </h3>
          </div>
        </div>

        <div className="price-box product-price-box">
          <ProductPriceRows currencySymbol={settings.currencySymbol} product={product} />
        </div>

        <div className="product-card-qty-row" aria-label="Cantidad">
          <button
            aria-label="Disminuir cantidad"
            className="product-card-qty-button"
            disabled={product.stockUnits <= 0 || quantity <= 1}
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            type="button"
          >
            <Minus size={14} />
          </button>
          <strong className="product-card-qty-value">{quantity}</strong>
          <button
            aria-label="Aumentar cantidad"
            className="product-card-qty-button"
            disabled={product.stockUnits <= 0 || quantity >= product.stockUnits}
            onClick={() => setQuantity((value) => Math.min(product.stockUnits, value + 1))}
            type="button"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="product-actions product-actions-dual">
          <button
            className="button button-primary"
            disabled={product.stockUnits <= 0}
            onClick={() => void handleAddToCart()}
            type="button"
          >
            <ShoppingCart size={16} />
            {product.stockUnits <= 0 ? "Sin stock" : "Añadir al carrito"}
          </button>
          <a className="button button-secondary" href={whatsappHref} rel="noreferrer" target="_blank">
            <MessageCircle size={16} />
            Consultar
          </a>
        </div>
      </div>
    </article>
  );
}
