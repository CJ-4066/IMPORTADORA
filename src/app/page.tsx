import type { CSSProperties } from "react";
import Link from "next/link";
import { getCatalogPageData } from "@/lib/store";
import type { CatalogProduct } from "@/lib/store";
import { CatalogExperience } from "@/components/catalog/catalog-experience";
import { HeroCarousel } from "@/components/catalog/hero-carousel";
import { HeroBannerCarousel } from "@/components/catalog/hero-banner-carousel";
import { HeroProductCarousel } from "@/components/catalog/hero-product-carousel";
import { PublicStoreHeader } from "@/components/catalog/public-store-header";
import { StoreSideActions } from "@/components/catalog/store-side-actions";
import { StoreFooter } from "@/components/catalog/store-footer";
import { getQuoteDefaultsForSession } from "@/lib/quote-profile";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildCatalogPageHref(input: {
  brand?: string;
  category: string;
  collection?: string;
  featuredOnly: boolean;
  page: number;
  q: string;
  sort: string;
}) {
  const { brand = "all", category, collection = "", featuredOnly, page, q, sort } = input;
  return `/?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}&sort=${encodeURIComponent(sort)}&page=${page}${featuredOnly ? "&featured=1" : ""}${collection ? `&collection=${encodeURIComponent(collection)}` : ""}`;
}

function getCollectionTitle(collection: string) {
  const titles: Record<string, string> = {
    alexas: "Alexas",
    consolas: "Consolas de videojuego",
    drones: "Drones",
    "mas-vendidos": "Productos más vendidos",
    ofertas: "Ofertas",
    preventa: "Preventa",
    proyectores: "Proyectores",
  };

  return titles[collection];
}

function formatSlugTitle(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function hasHeroMedia(product: CatalogProduct) {
  return Boolean(product.primaryMedia?.url || product.imageUrl);
}

function scoreHeroProduct(product: CatalogProduct) {
  let score = 0;

  if (hasHeroMedia(product)) {
    score += 30;
  }

  if (product.isFeatured) {
    score += 15;
  }

  if (product.stockUnits > 0) {
    score += 10;
  }

  score += Math.min(10, Math.round(product.stockUnits / 15));
  score += product.brand ? 2 : 0;

  return score;
}

function pickHeroProducts(products: CatalogProduct[]) {
  const filtered = products.filter(hasHeroMedia);

  return filtered
    .slice()
    .sort((left, right) => {
      const scoreDelta = scoreHeroProduct(right) - scoreHeroProduct(left);

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })
    .slice(0, 8);
}

function CatalogPagination({
  brand,
  category,
  collection,
  featuredOnly,
  page,
  q,
  sort,
  totalPages,
}: {
  brand: string;
  category: string;
  collection: string;
  featuredOnly: boolean;
  page: number;
  q: string;
  sort: string;
  totalPages: number;
}) {
  return (
    <section className="pagination-row">
      {page > 1 ? (
        <Link
          className="button button-secondary"
          href={buildCatalogPageHref({ brand, category, collection, featuredOnly, page: page - 1, q, sort })}
        >
          Página anterior
        </Link>
      ) : (
        <span />
      )}
      {page < totalPages ? (
        <Link
          className="button button-secondary"
          href={buildCatalogPageHref({ brand, category, collection, featuredOnly, page: page + 1, q, sort })}
        >
          Siguiente página
        </Link>
      ) : null}
    </section>
  );
}

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : undefined;
  const q = typeof params?.q === "string" ? params.q : "";
  const category = typeof params?.category === "string" ? params.category : "all";
  const brand = typeof params?.brand === "string" ? params.brand : "all";
  const collection = typeof params?.collection === "string" ? params.collection : "";
  const sort = typeof params?.sort === "string" ? params.sort : "featured";
  const page = Number(typeof params?.page === "string" ? params.page : "1");
  const normalizedCollection = collection.toLowerCase();
  const collectionQueryMap: Record<string, string> = {
    preventa: "preventa",
    proyectores: "proyector",
    alexas: "alexa",
  };
  const resolvedQuery = q || collectionQueryMap[normalizedCollection] || "";
  const featuredOnly =
    params?.featured === "1" || normalizedCollection === "ofertas";
  const initialCartOpen = params?.drawer === "cart";
  const focusSearch = params?.focus === "search";
  const [data, quoteDefaults] = await Promise.all([
    getCatalogPageData({
      query: resolvedQuery,
      category,
      brand,
      collection: normalizedCollection,
      page: Number.isNaN(page) ? 1 : page,
      featuredOnly,
      sort,
    }),
    getQuoteDefaultsForSession(),
  ]);
  const themeVars = {
    "--brand-primary": data.settings.primaryColor,
    "--brand-accent": data.settings.accentColor,
  } as CSSProperties & Record<"--brand-primary" | "--brand-accent", string>;
  const isSectionedView =
    !resolvedQuery &&
    category === "all" &&
    brand === "all" &&
    !normalizedCollection &&
    !featuredOnly &&
    data.page === 1;
  const selectedCategory = data.categories.find(
    (item) => item.slug === category || item.name === category,
  );
  const categoryTitle =
    category !== "all" ? selectedCategory?.name ?? formatSlugTitle(category) : undefined;
  const catalogTitle =
    categoryTitle ??
    getCollectionTitle(normalizedCollection) ??
    (brand !== "all" ? `Marca: ${brand}` : undefined) ??
    (resolvedQuery ? `Resultados para "${resolvedQuery}"` : undefined) ??
    "Productos";
  const heroProducts = pickHeroProducts([...data.bestSellerProducts, ...data.products]);

  return (
    <main className="site-shell" id="home-top" style={themeVars}>
      <PublicStoreHeader
        brands={data.brands}
        categories={data.categories}
        focusSearch={focusSearch}
      />

      {isSectionedView ? (
        <section className="hero" data-hero>
          <div className="hero-grid hero-grid-centered">
            <div className="hero-panel hero-panel-fixed">
              {data.heroBanners.length ? (
                <HeroBannerCarousel
                  banners={data.heroBanners}
                  intervalSeconds={data.settings.heroAutoplaySeconds}
                />
              ) : heroProducts.length >= 2 ? (
                <HeroProductCarousel intervalSeconds={data.settings.heroAutoplaySeconds} products={heroProducts} />
              ) : data.settings.heroSlides.length ? (
                <HeroCarousel
                  intervalSeconds={data.settings.heroAutoplaySeconds}
                  slides={data.settings.heroSlides}
                />
              ) : (
                <>
                  <p>{data.settings.highlightMessage}</p>
                  <span>Atención: {data.settings.supportHours}</span>
                </>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="catalog-experience-shell" id="catalogo">
        <CatalogExperience
          bestSellerProducts={data.bestSellerProducts}
          catalogTitle={catalogTitle}
          initialCartOpen={initialCartOpen}
          isSectionedView={isSectionedView}
          products={data.products}
          quoteDefaults={quoteDefaults}
          salesSummary={data.salesSummary}
          settings={data.settings}
        />
      </section>

      <StoreSideActions
        settings={data.settings}
        showHomeShortcut={data.totalResults === 0 || data.products.length === 0}
      />

      <CatalogPagination
        brand={brand}
        category={category}
        collection={normalizedCollection}
        featuredOnly={featuredOnly}
        page={data.page}
        q={resolvedQuery}
        sort={data.selectedSort}
        totalPages={data.totalPages}
      />

      <StoreFooter />
    </main>
  );
}
