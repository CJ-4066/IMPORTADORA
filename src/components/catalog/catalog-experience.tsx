"use client";

import Link from "next/link";
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

const takeSix = (items: CatalogProduct[]) => items.slice(0, 6);

const textIncludes = (product: CatalogProduct, words: string[]) => {
  const text = `${product.name} ${product.category ?? ""} ${product.brand ?? ""}`.toLowerCase();
  return words.some((word) => text.includes(word));
};

function ProductSection({
  title,
  subtitle,
  products,
  href,
  settings,
  slider = false,
}: {
  title: string;
  subtitle: string;
  products: CatalogProduct[];
  href?: string;
  settings: StoreSettingsView;
  slider?: boolean;
}) {
  if (!products.length) return null;

  const visibleProducts = slider ? products : takeSix(products);
  const productsToRender = slider ? [...visibleProducts, ...visibleProducts] : visibleProducts;

  return (
    <section className="catalog-section">
      <div className="catalog-section-header">
        <div>
          <p className="catalog-section-eyebrow">Colección destacada</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        {href ? (
          <Link className="catalog-section-link" href={href}>
            Ver todos
          </Link>
        ) : null}
      </div>

      <div className={slider ? "catalog-slider" : "catalog-section-grid"}>
        <div className={slider ? "catalog-slider-track" : "catalog-grid-inner"}>
          {productsToRender.map((product, index) => (
            <div className={slider ? "catalog-slider-item" : undefined} key={`${title}-${product.id}-${index}`}>
              <ProductCard product={product} settings={settings} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CatalogExperience({
  products,
  settings,
  initialCartOpen = false,
  quoteDefaults = null,
}: CatalogExperienceProps) {
  const featuredProducts = products.filter((product) => product.isFeatured);
  const bestSellerProducts = featuredProducts.length ? featuredProducts : products;

  const giftProducts = takeSix(
    products.filter((product) =>
      textIncludes(product, ["regalo", "gift", "peluche", "perfume", "reloj", "audifono", "audífono"]),
    ),
  );

  const kitchenProducts = takeSix(
    products.filter((product) =>
      textIncludes(product, ["cocina", "olla", "sarten", "sartén", "vaso", "plato", "termo", "licuadora"]),
    ),
  );

  const categoryGroups = Object.values(
    products.reduce<Record<string, CatalogProduct[]>>((groups, product) => {
      const category = product.category?.trim();
      if (!category) return groups;

      if (!groups[category]) {
        groups[category] = [];
      }

      if (groups[category].length < 6) {
        groups[category].push(product);
      }

      return groups;
    }, {}),
  ).slice(0, 4);

  return (
    <>
      <CartStoreBootstrap />

      {products.length ? (
        <div className="catalog-sections-layout">
          <ProductSection
            title="Productos más vendidos"
            subtitle="Una selección rápida de productos destacados que se mueven automáticamente."
            products={bestSellerProducts}
            href="/?collection=mas-vendidos"
            settings={settings}
            slider
          />

          <ProductSection
            title="Productos para regalar"
            subtitle="Ideas prácticas para sorprender a clientes, familia o amistades."
            products={giftProducts}
            settings={settings}
          />

          <ProductSection
            title="Cosas para cocina"
            subtitle="Artículos útiles para casa, negocio o pedidos por volumen."
            products={kitchenProducts}
            settings={settings}
          />

          {categoryGroups.map((group) => {
            const category = group[0]?.category ?? "Catálogo";

            return (
              <ProductSection
                key={category}
                title={category}
                subtitle={`Productos disponibles en la categoría ${category}.`}
                products={group}
                href={`/?category=${encodeURIComponent(category)}`}
                settings={settings}
              />
            );
          })}
        </div>
      ) : null}

      <CartDrawer initialOpen={initialCartOpen} quoteDefaults={quoteDefaults} settings={settings} />
    </>
  );
}