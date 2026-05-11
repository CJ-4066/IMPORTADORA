"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

type ProductSectionProps = {
  title: string;
  subtitle: string;
  products: CatalogProduct[];
  settings: StoreSettingsView;
  href: string;
  featured?: boolean;
};

const SECTION_LIMIT = 6;

const takeSectionProducts = (items: CatalogProduct[]) => items.slice(0, SECTION_LIMIT);

const fallbackSectionProducts = (products: CatalogProduct[], offset: number) =>
  products.slice(offset, offset + SECTION_LIMIT).length
    ? products.slice(offset, offset + SECTION_LIMIT)
    : products.slice(0, SECTION_LIMIT);

const productMatches = (product: CatalogProduct, words: string[]) => {
  const text = `${product.name} ${product.category ?? ""} ${product.brand ?? ""}`.toLowerCase();
  return words.some((word) => text.includes(word));
};

function ProductSection({
  title,
  subtitle,
  products,
  settings,
  href,
  featured = false,
}: ProductSectionProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const sectionProducts = takeSectionProducts(products);

  if (!sectionProducts.length) {
    return null;
  }

  const scrollFeatured = (direction: "prev" | "next") => {
    const slider = sliderRef.current;

    if (!slider) {
      return;
    }

    slider.scrollBy({
      behavior: "smooth",
      left: direction === "next" ? slider.clientWidth * 0.78 : slider.clientWidth * -0.78,
    });
  };

  return (
    <section className={`catalog-section ${featured ? "catalog-section-featured" : ""}`}>
      <div className="catalog-section-header">
        <div>
          <p className="catalog-section-eyebrow">{featured ? "Selección destacada" : "Colección"}</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        <div className="catalog-section-actions">
          {featured ? (
            <div className="catalog-slider-controls" aria-label="Controles de productos destacados">
              <button
                aria-label="Ver productos anteriores"
                className="catalog-slider-button"
                onClick={() => scrollFeatured("prev")}
                type="button"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                aria-label="Ver productos siguientes"
                className="catalog-slider-button"
                onClick={() => scrollFeatured("next")}
                type="button"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          ) : null}

          <Link className="catalog-section-link" href={href}>
            Ver más
          </Link>
        </div>
      </div>

      {featured ? (
        <div className="catalog-featured-slider" ref={sliderRef}>
          {sectionProducts.map((product) => (
            <div className="catalog-featured-slide" key={product.id}>
              <ProductCard badgeLabel="Top ventas" product={product} settings={settings} />
            </div>
          ))}
        </div>
      ) : (
        <div className="catalog-section-grid">
          {sectionProducts.map((product) => (
            <ProductCard key={product.id} product={product} settings={settings} />
          ))}
        </div>
      )}
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
  const topProducts = featuredProducts.length ? featuredProducts : products;
  const giftMatches = products.filter((product) =>
    productMatches(product, ["regalo", "gift", "peluche", "perfume", "reloj", "juguete", "escolar"]),
  );
  const homeMatches = products.filter((product) =>
    productMatches(product, [
      "cocina",
      "hogar",
      "olla",
      "sarten",
      "sartén",
      "vaso",
      "plato",
      "termo",
      "licuadora",
      "foco",
      "ventilador",
    ]),
  );
  const techMatches = products.filter((product) =>
    productMatches(product, [
      "xiaomi",
      "celular",
      "auricular",
      "parlante",
      "proyector",
      "drone",
      "consola",
      "power",
      "smart",
      "usb",
      "laptop",
    ]),
  );
  const accessoryMatches = products.filter((product) =>
    productMatches(product, [
      "accesorio",
      "soporte",
      "cargador",
      "cable",
      "bateria",
      "batería",
      "auto",
      "funda",
      "bolso",
    ]),
  );
  const giftProducts = giftMatches.length ? giftMatches : fallbackSectionProducts(products, 6);
  const homeProducts = homeMatches.length ? homeMatches : fallbackSectionProducts(products, 12);
  const techProducts = techMatches.length ? techMatches : fallbackSectionProducts(products, 0);
  const accessoryProducts = accessoryMatches.length ? accessoryMatches : fallbackSectionProducts(products, 18);

  return (
    <>
      <CartStoreBootstrap />

      {products.length ? (
        <div className="catalog-sections-layout">
          <ProductSection
            featured
            href="/?collection=mas-vendidos"
            products={topProducts}
            settings={settings}
            title="Productos más vendidos"
          />

          <ProductSection
            href="/?q=regalo"
            products={giftProducts}
            settings={settings}
            subtitle="Opciones prácticas para clientes, familia o pedidos por campaña."
            title="Ideas para regalar"
          />

          <ProductSection
            href="/?q=cocina"
            products={homeProducts}
            settings={settings}
            subtitle="Artículos para casa, negocio y reposición por volumen."
            title="Cocina y hogar"
          />

          <ProductSection
            href="/?q=tecnologia"
            products={techProducts}
            settings={settings}
            subtitle="Dispositivos, audio, energía y accesorios de uso diario."
            title="Tecnología"
          />

          <ProductSection
            href="/?q=accesorio"
            products={accessoryProducts}
            settings={settings}
            subtitle="Complementos pequeños con alta rotación para venta rápida."
            title="Accesorios"
          />
        </div>
      ) : null}

      <CartDrawer initialOpen={initialCartOpen} quoteDefaults={quoteDefaults} settings={settings} />
    </>
  );
}
