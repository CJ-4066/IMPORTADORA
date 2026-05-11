"use client";

import type { CatalogProduct, StoreSettingsView } from "@/lib/store";
import { CartStoreBootstrap } from "@/components/catalog/cart-store-bootstrap";
import { ProductCard } from "@/components/catalog/product-card";
import { CartDrawer } from "@/components/catalog/cart-drawer";

type CatalogExperienceProps = {
  products: CatalogProduct[];
  settings: StoreSettingsView;
  initialCartOpen?: boolean;
  quoteDefaults?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
};

export function CatalogExperience({
  products,
  settings,
  initialCartOpen = false,
  quoteDefaults = null,
}: CatalogExperienceProps) {
  return (
    <>
      <CartStoreBootstrap />

      {products.length ? (
        <section className="catalog-section">
          <div className="catalog-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} settings={settings} />
            ))}
          </div>
        </section>
      ) : null}

      <CartDrawer initialOpen={initialCartOpen} quoteDefaults={quoteDefaults} settings={settings} />
    </>
  );
}
