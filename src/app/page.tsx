import type { CSSProperties } from "react";
import Link from "next/link";
import { getCatalogPageData } from "@/lib/store";
import { CatalogExperience } from "@/components/catalog/catalog-experience";
import { HeroCarousel } from "@/components/catalog/hero-carousel";
import { PublicStoreHeader } from "@/components/catalog/public-store-header";
import { StoreSideActions } from "@/components/catalog/store-side-actions";
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
}) {
  const { brand = "all", category, collection = "", featuredOnly, page, q } = input;
  return `/?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}&page=${page}${featuredOnly ? "&featured=1" : ""}${collection ? `&collection=${encodeURIComponent(collection)}` : ""}`;
}


function CatalogPagination({
  brand,
  category,
  collection,
  featuredOnly,
  page,
  q,
  totalPages,
}: {
  brand: string;
  category: string;
  collection: string;
  featuredOnly: boolean;
  page: number;
  q: string;
  totalPages: number;
}) {
  return (
    <section className="pagination-row">
      {page > 1 ? (
        <Link
          className="button button-secondary"
          href={buildCatalogPageHref({ brand, category, collection, featuredOnly, page: page - 1, q })}
        >
          Página anterior
        </Link>
      ) : (
        <span />
      )}
      {page < totalPages ? (
        <Link
          className="button button-secondary"
          href={buildCatalogPageHref({ brand, category, collection, featuredOnly, page: page + 1, q })}
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
  const page = Number(typeof params?.page === "string" ? params.page : "1");
  const normalizedCollection = collection.toLowerCase();
  const collectionQueryMap: Record<string, string> = {
    preventa: "preventa",
    proyectores: "proyector",
    drones: "drone",
    alexas: "alexa",
    consolas: "consola videojuego",
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
    }),
    getQuoteDefaultsForSession(),
  ]);
  const themeVars = {
    "--brand-primary": data.settings.primaryColor,
    "--brand-accent": data.settings.accentColor,
  } as CSSProperties & Record<"--brand-primary" | "--brand-accent", string>;

  return (
    <main className="site-shell" style={themeVars}>
      <PublicStoreHeader focusSearch={focusSearch} />

      <section className="hero">
        <div className="hero-grid hero-grid-centered">
          <div className="hero-panel">
            {data.settings.heroSlides.length ? (
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

      <section className="catalog-section">
        <CatalogExperience
          initialCartOpen={initialCartOpen}
          products={data.products}
          quoteDefaults={quoteDefaults}
          settings={data.settings}
        />
      </section>

      <StoreSideActions settings={data.settings} />

      <CatalogPagination
        brand={brand}
        category={category}
        collection={normalizedCollection}
        featuredOnly={featuredOnly}
        page={data.page}
        q={resolvedQuery}
        totalPages={data.totalPages}
      />
    </main>
  );
}
