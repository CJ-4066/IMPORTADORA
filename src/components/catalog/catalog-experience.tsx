"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  CatalogProduct,
  CatalogSalesSummary,
  StoreSettingsView,
} from "@/lib/store";
import { CartStoreBootstrap } from "@/components/catalog/cart-store-bootstrap";
import { ProductCard } from "@/components/catalog/product-card";
import { CartDrawer } from "@/components/catalog/cart-drawer";

type CatalogExperienceProps = {
  bestSellerProducts?: CatalogProduct[];
  catalogTitle?: string;
  isSectionedView?: boolean;
  products: CatalogProduct[];
  salesSummary?: CatalogSalesSummary;
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
  subtitle?: string;
  products: CatalogProduct[];
  settings: StoreSettingsView;
  href: string;
  featured?: boolean;
  badgeLabel?: string;
  limit?: number;
};

const FEATURED_SECTION_LIMIT = 6;
const GRID_SECTION_LIMIT = 8;

const takeSectionProducts = (items: CatalogProduct[], limit: number) =>
  items.slice(0, limit);

const fallbackSectionProducts = (
  products: CatalogProduct[],
  offset: number,
  limit = GRID_SECTION_LIMIT,
) =>
  products.slice(offset, offset + limit).length
    ? products.slice(offset, offset + limit)
    : products.slice(0, limit);

const fillSectionProducts = (
  preferredProducts: CatalogProduct[],
  allProducts: CatalogProduct[],
  offset = 0,
  limit = GRID_SECTION_LIMIT,
) => {
  const selected: CatalogProduct[] = [];
  const selectedIds = new Set<string>();

  const addProduct = (product: CatalogProduct) => {
    if (selected.length >= limit || selectedIds.has(product.id)) {
      return;
    }

    selectedIds.add(product.id);
    selected.push(product);
  };

  preferredProducts.forEach(addProduct);

  if (selected.length >= limit) {
    return selected;
  }

  const rotatedFallbackProducts = [
    ...allProducts.slice(offset),
    ...allProducts.slice(0, offset),
  ];

  sortProductsByImageQuality(rotatedFallbackProducts).forEach(addProduct);

  return selected;
};

const productMatches = (
  product: CatalogProduct,
  words: string[],
) => {
  const text =
    `${product.name} ${product.category ?? ""} ${product.brand ?? ""}`.toLowerCase();

  return words.some((word) => text.includes(word));
};

const getProductText = (product: CatalogProduct) =>
  `${product.name} ${product.category ?? ""} ${product.brand ?? ""}`.toLowerCase();

const isAdultCatalogProduct = (product: CatalogProduct) => {
  const text = getProductText(product);

  return (
    text.includes("juguetes sexuales") ||
    text.includes("consolador") ||
    text.includes("pretty love") ||
    text.includes("vibrator") ||
    text.includes("we love")
  );
};

const hasUsableProductImage = (product: CatalogProduct) => {
  const mediaUrl = product.primaryMedia?.url ?? product.imageUrl ?? "";
  const normalized = mediaUrl.toLowerCase();

  return (
    Boolean(mediaUrl.trim()) &&
    product.primaryMedia?.type !== "VIDEO" &&
    !normalized.includes("imagen-no-disponible") &&
    !normalized.includes("placeholder")
  );
};

const sortProductsByImageQuality = (items: CatalogProduct[]) =>
  items.slice().sort((left, right) => {
    const leftHasImage = hasUsableProductImage(left) ? 1 : 0;
    const rightHasImage = hasUsableProductImage(right) ? 1 : 0;

    if (leftHasImage !== rightHasImage) {
      return rightHasImage - leftHasImage;
    }

    if (left.isFeatured !== right.isFeatured) {
      return Number(right.isFeatured) - Number(left.isFeatured);
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

const giftScoreWords = [
  { score: 38, words: ["reloj", "smart watch", "smartwatch", "watch"] },
  { score: 36, words: ["auricular", "audifono", "audífono", "bluetooth", "parlante"] },
  { score: 34, words: ["peluche", "juguete", "muñeca", "carrito", "control remoto"] },
  { score: 32, words: ["perfume", "billetera", "bolso", "mochila", "accesorio"] },
  { score: 30, words: ["cuidado personal", "maquina", "máquina", "secador", "afeitadora"] },
  { score: 24, words: ["lampara", "lámpara", "luz", "led", "decoracion", "decoración"] },
  { score: 22, words: ["termo", "taza", "organizador", "escolar"] },
  { score: 18, words: ["celular", "xiaomi", "smart", "usb", "power bank"] },
];

const getGiftScore = (product: CatalogProduct) => {
  const text = getProductText(product);
  let score = hasUsableProductImage(product) ? 28 : 0;

  if (product.isFeatured) {
    score += 8;
  }

  if (product.stockUnits > 0) {
    score += 6;
  }

  for (const group of giftScoreWords) {
    if (group.words.some((word) => text.includes(word))) {
      score += group.score;
    }
  }

  return score;
};

const getGiftProducts = (products: CatalogProduct[]) =>
  products
    .map((product) => ({
      product,
      score: getGiftScore(product),
    }))
    .filter((item) => item.score >= 24)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return (
        Number(hasUsableProductImage(right.product)) -
          Number(hasUsableProductImage(left.product)) ||
        new Date(right.product.updatedAt).getTime() -
          new Date(left.product.updatedAt).getTime()
      );
    })
    .map((item) => item.product);

const getScoredProducts = (
  products: CatalogProduct[],
  groups: { score: number; words: string[] }[],
  minimumScore: number,
) =>
  products
    .map((product) => {
      const text = getProductText(product);
      let score = hasUsableProductImage(product) ? 30 : 0;

      if (product.isFeatured) {
        score += 6;
      }

      if (product.stockUnits > 0) {
        score += 4;
      }

      for (const group of groups) {
        if (group.words.some((word) => text.includes(word))) {
          score += group.score;
        }
      }

      return { product, score };
    })
    .filter((item) => item.score >= minimumScore)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return (
        Number(hasUsableProductImage(right.product)) -
          Number(hasUsableProductImage(left.product)) ||
        new Date(right.product.updatedAt).getTime() -
          new Date(left.product.updatedAt).getTime()
      );
    })
    .map((item) => item.product);

const technologyScoreWords = [
  { score: 42, words: ["proyector", "drone", "consola", "gamepad", "videojuego"] },
  { score: 40, words: ["xiaomi", "alexa", "smart", "smartwatch", "smart watch"] },
  { score: 38, words: ["auricular", "audifono", "audífono", "parlante", "bluetooth"] },
  { score: 34, words: ["power bank", "bateria", "batería", "cargador", "carga"] },
  { score: 32, words: ["usb", "memoria", "micro sd", "microsd", "sd card", "almacenamiento"] },
  { score: 30, words: ["camara", "cámara", "seguridad", "wifi", "laptop", "teclado", "mouse"] },
];

const accessoryScoreWords = [
  { score: 42, words: ["auto", "vehicular", "carro", "llanta", "soporte"] },
  { score: 40, words: ["usb", "cable", "cargador", "adaptador", "hub"] },
  { score: 36, words: ["funda", "case", "protector", "mica", "soporte"] },
  { score: 34, words: ["bateria", "batería", "power bank", "pilas"] },
  { score: 30, words: ["bolso", "billetera", "mochila", "organizador"] },
  { score: 26, words: ["accesorio", "repuesto", "complemento"] },
];

function ProductSection({
  title,
  subtitle,
  products,
  settings,
  href,
  featured = false,
  badgeLabel,
  limit,
}: ProductSectionProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const sectionLimit = limit ?? (featured ? FEATURED_SECTION_LIMIT : GRID_SECTION_LIMIT);

  const sectionProducts = takeSectionProducts(products, sectionLimit);

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
      left:
        direction === "next"
          ? slider.clientWidth * 0.78
          : slider.clientWidth * -0.78,
    });
  };

  return (
    <section
      className={`catalog-section ${
        featured ? "catalog-section-featured" : ""
      }`}
    >
      <div className="catalog-section-header">
        <div>
          <p className="catalog-section-eyebrow">
            {featured ? "Selección destacada" : "Colección"}
          </p>

          <h2>{title}</h2>

          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        <div className="catalog-section-actions">
          {featured ? (
            <div
              className="catalog-slider-controls"
              aria-label="Controles de productos destacados"
            >
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
              <ProductCard
                badgeLabel={badgeLabel}
                product={product}
                settings={settings}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="catalog-section-grid">
          {sectionProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              settings={settings}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProductGridView({
  products,
  settings,
  title = "Productos",
}: {
  products: CatalogProduct[];
  settings: StoreSettingsView;
  title?: string;
}) {
  return (
    <section className="catalog-section catalog-results-section">
      <div className="catalog-section-header">
        <div>
          <p className="catalog-section-eyebrow">Catálogo</p>
          <h2>{title}</h2>
        </div>
      </div>

      {products.length ? (
        <div className="catalog-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} settings={settings} />
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <h2>No hay productos disponibles</h2>
          <p>Prueba con otra categoría o busca otro producto.</p>
        </section>
      )}
    </section>
  );
}

export function CatalogExperience({
  bestSellerProducts = [],
  catalogTitle,
  isSectionedView = true,
  products,
  salesSummary,
  settings,
  initialCartOpen = false,
  quoteDefaults = null,
}: CatalogExperienceProps) {
  const storefrontProducts = products.filter(
    (product) => !isAdultCatalogProduct(product),
  );
  const storefrontBestSellerProducts = bestSellerProducts.filter(
    (product) => !isAdultCatalogProduct(product),
  );
  const featuredProducts = products.filter(
    (product) => product.isFeatured && !isAdultCatalogProduct(product),
  );

  const hasRealBestSellers =
    Boolean(salesSummary?.hasRealSales) && storefrontBestSellerProducts.length > 0;
  const topProducts = fillSectionProducts(
    hasRealBestSellers
      ? storefrontBestSellerProducts
      : featuredProducts.length
        ? sortProductsByImageQuality(featuredProducts)
        : sortProductsByImageQuality(storefrontProducts),
    storefrontProducts,
    0,
    FEATURED_SECTION_LIMIT,
  );

  const giftMatches = getGiftProducts(storefrontProducts);

  const homeMatches = storefrontProducts.filter((product) =>
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

  const techMatches = getScoredProducts(storefrontProducts, technologyScoreWords, 34);

  const accessoryMatches = getScoredProducts(storefrontProducts, accessoryScoreWords, 34);

  const giftProducts = fillSectionProducts(
    giftMatches.length
      ? giftMatches
      : sortProductsByImageQuality(fallbackSectionProducts(storefrontProducts, 6)),
    storefrontProducts,
    6,
    GRID_SECTION_LIMIT,
  );

  const homeProducts = fillSectionProducts(
    homeMatches.length
      ? homeMatches
      : fallbackSectionProducts(storefrontProducts, 12),
    storefrontProducts,
    12,
    GRID_SECTION_LIMIT,
  );

  const techProducts = fillSectionProducts(
    techMatches.length
      ? techMatches
      : sortProductsByImageQuality(fallbackSectionProducts(storefrontProducts, 0)),
    storefrontProducts,
    0,
    GRID_SECTION_LIMIT,
  );

  const accessoryProducts = fillSectionProducts(
    accessoryMatches.length
      ? accessoryMatches
      : sortProductsByImageQuality(fallbackSectionProducts(storefrontProducts, 18)),
    storefrontProducts,
    18,
    GRID_SECTION_LIMIT,
  );

  return (
    <>
      <CartStoreBootstrap />

      {isSectionedView ? (
        <div className="catalog-sections-layout">
          <ProductSection
            featured
            badgeLabel={hasRealBestSellers ? "Top ventas" : "Destacado"}
            title={hasRealBestSellers ? "Productos más vendidos" : "Productos destacados"}
            subtitle={hasRealBestSellers ? "Ventas ERP por producto y rotación por unidades." : undefined}
            href="/?collection=mas-vendidos"
            products={topProducts}
            settings={settings}
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
      ) : (
        <ProductGridView products={products} settings={settings} title={catalogTitle} />
      )}

      <CartDrawer
        initialOpen={initialCartOpen}
        quoteDefaults={quoteDefaults}
        settings={settings}
      />
    </>
  );
}
