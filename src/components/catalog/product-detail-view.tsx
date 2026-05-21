"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ImageIcon, Minus, Plus, ShoppingCart, Tags } from "lucide-react";
import { STORE_CART_OPEN_EVENT } from "@/components/catalog/cart-events";
import { CartStoreBootstrap } from "@/components/catalog/cart-store-bootstrap";
import { isCartStoreHydrated, rehydrateCartStore, useCartStore } from "@/components/catalog/cart-store";
import { getSafeMediaUrl } from "@/lib/media-url";
import { getPublicProductName } from "@/lib/product-name";
import type { CatalogProduct, ProductMediaView, StoreSettingsView } from "@/lib/store";
import { isGenericProductPhotoUrl } from "@/lib/store-shared";
import { formatCurrency } from "@/lib/utils";
import {
  getProductDiscountPercent,
  ProductPriceRows,
  ProductStockChip,
} from "@/components/catalog/product-display";

type ProductDetailViewProps = {
  product: CatalogProduct;
  settings: StoreSettingsView;
};

function getFallbackMedia(product: CatalogProduct): ProductMediaView | null {
  return product.primaryMedia
    ? product.primaryMedia
    : product.localImageUrl
      ? {
          id: "local-image",
          type: "IMAGE",
          url: product.localImageUrl,
          altText: product.name,
          sortOrder: 0,
        }
    : product.imageUrl && !isGenericProductPhotoUrl(product.imageUrl)
      ? {
          id: "legacy-image",
          type: "IMAGE",
          url: product.imageUrl,
          altText: product.name,
          sortOrder: 0,
        }
      : null;
}

export function ProductDetailView({ product, settings }: ProductDetailViewProps) {
  const addItem = useCartStore((state) => state.addItem);
  const displayName = getPublicProductName(product.name);
  const gallery = useMemo(() => {
    const media = product.media.filter((item) => !isGenericProductPhotoUrl(item.url));
    const fallback = getFallbackMedia(product);

    if (media.length) {
      return media;
    }

    return fallback ? [fallback] : [];
  }, [product]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [imageFailed, setImageFailed] = useState<Record<string, boolean>>({});

  const activeMedia = gallery[activeIndex] ?? null;
  const activeMediaUrl = getSafeMediaUrl(activeMedia?.url);
  const maxQuantity = product.stockUnits;
  const safeQuantity = Math.min(Math.max(quantity, 1), Math.max(maxQuantity, 1));
  const wholesaleApplies =
    Boolean(product.wholesalePrice) &&
    safeQuantity >= product.wholesaleMinQty;
  const discountPercent = getProductDiscountPercent(product);
  const effectiveUnitPrice = wholesaleApplies
    ? product.wholesalePrice ?? product.unitPrice
    : product.unitPrice;
  const total = effectiveUnitPrice * safeQuantity;

  const handleAdd = async () => {
    if (maxQuantity <= 0) {
      return;
    }

    if (!isCartStoreHydrated()) {
      await rehydrateCartStore();
    }

    addItem(product, "unit");

    for (let index = 1; index < safeQuantity; index += 1) {
      addItem(product, "unit");
    }

    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(STORE_CART_OPEN_EVENT));
    });
  };

  return (
    <section className="product-detail-layout">
      <CartStoreBootstrap />
      <div className="product-detail-main">
        <div className="product-detail-gallery-card">
          <div className="product-detail-breadcrumb">
            <Link className="button button-ghost" href="/">
              <ArrowLeft size={16} />
              Volver al catálogo
            </Link>
            {product.category ? (
              <Link className="pill product-detail-category-link" href={`/?category=${encodeURIComponent(product.category)}`}>
                {product.category}
              </Link>
            ) : null}
          </div>

          <div className="product-detail-stage">
            {activeMedia && activeMediaUrl && !(activeMedia.type === "IMAGE" && imageFailed[activeMedia.id]) ? (
              activeMedia.type === "IMAGE" ? (
                <div className="product-detail-stage-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={activeMedia.altText ?? displayName}
                    decoding="async"
                    onError={() =>
                      setImageFailed((current) => ({
                        ...current,
                        [activeMedia.id]: true,
                      }))
                    }
                    referrerPolicy="no-referrer"
                    src={activeMediaUrl}
                  />
                </div>
              ) : (
                <div className="product-detail-stage-media">
                  <video controls playsInline preload="metadata" src={activeMediaUrl} />
                </div>
              )
            ) : (
              <div className="product-detail-stage product-detail-stage-fallback">
                <ImageIcon size={36} />
                <strong>{product.category ?? "Producto"}</strong>
                <span>{displayName}</span>
              </div>
            )}
          </div>

          {gallery.length > 1 ? (
            <div className="product-detail-thumbs">
              {gallery.map((media, index) => (
                <button
                  className={`product-detail-thumb ${index === activeIndex ? "is-active" : ""}`}
                  key={media.id}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                >
                  {media.type === "IMAGE" && !imageFailed[media.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={media.altText ?? `${displayName} ${index + 1}`}
                      decoding="async"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      src={getSafeMediaUrl(media.url) ?? media.url}
                    />
                  ) : (
                    <span>{media.type === "VIDEO" ? "Video" : "Vista"}</span>
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <article className="panel product-detail-copy-card">
          <div className="stack-sm">
          <div className="product-detail-code-row">
            <span className="product-code">{product.code}</span>
            <ProductStockChip product={product} />
            {product.isFeatured ? (
              <span className="pill pill-accent">
                Oferta{discountPercent ? ` -${discountPercent}%` : ""}
              </span>
            ) : null}
            </div>

            <div className="stack-xs">
              <h1>{displayName}</h1>
            </div>

            {product.description ? <p className="product-detail-description">{product.description}</p> : null}

            {/* CHANGE-CODE: CAT-002 */}
            {product.technicalSpecs ? (
              <section className="product-detail-specs-card">
                <p className="eyebrow">Especificaciones técnicas</p>
                <div className="product-detail-specs">{product.technicalSpecs}</div>
              </section>
            ) : null}
          </div>

          <div className="product-detail-price-box">
            <div className="product-detail-price-main">
              <span>{wholesaleApplies ? "Precio mayorista activo" : "Precio unitario"}</span>
              <strong>{formatCurrency(effectiveUnitPrice, settings.currencySymbol)}</strong>
            </div>

            <div className="product-detail-price-lines">
              <ProductPriceRows currencySymbol={settings.currencySymbol} product={product} />
            </div>
          </div>

          <div className="product-detail-buybox">
            <div className="product-detail-mode-row">
              <span className="mode-chip is-active">
                <Tags size={16} />
                Unidad
              </span>
            </div>

            <div className="product-detail-qty-row">
              <div className="product-detail-qty-control">
                <button
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  type="button"
                >
                  <Minus size={16} />
                </button>
                <strong>{safeQuantity}</strong>
                <button
                  onClick={() => setQuantity((value) => Math.min(Math.max(maxQuantity, 1), value + 1))}
                  type="button"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="product-detail-total">
                <span>Total estimado</span>
                <strong>{formatCurrency(total, settings.currencySymbol)}</strong>
              </div>
            </div>

            <div className="product-detail-buy-note">
              <span>
                {wholesaleApplies
                  ? `Ya aplica el precio mayorista desde ${product.wholesaleMinQty} unidades.`
                  : `Compra ${product.wholesaleMinQty} o más para activar el precio mayorista.`}
              </span>
            </div>

            <div className="product-detail-buy-actions">
              <button
                className="button button-primary"
                disabled={maxQuantity <= 0}
                onClick={() => void handleAdd()}
                type="button"
              >
                <ShoppingCart size={16} />
                Añadir al carrito
              </button>
              <Link className="button button-secondary" href="/">
                Seguir comprando
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
