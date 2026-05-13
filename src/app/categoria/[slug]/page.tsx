import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CartDrawer } from "@/components/catalog/cart-drawer";
import { CartStoreBootstrap } from "@/components/catalog/cart-store-bootstrap";
import { ProductCard } from "@/components/catalog/product-card";
import { PublicStoreHeader } from "@/components/catalog/public-store-header";
import { StoreSideActions } from "@/components/catalog/store-side-actions";
import { getQuoteDefaultsForSession } from "@/lib/quote-profile";
import { getCatalogPageData } from "@/lib/store-catalog";

type CategoryPageProps = {
  params?: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildCategoryPageHref(slug: string, page: number) {
  return `/categoria/${encodeURIComponent(slug)}?page=${page}`;
}

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const routeParams = params ? await params : undefined;
  const queryParams = searchParams ? await searchParams : undefined;
  const slug = routeParams?.slug;
  const page = Number(typeof queryParams?.page === "string" ? queryParams.page : "1");
  const initialCartOpen = queryParams?.drawer === "cart";

  if (!slug) {
    notFound();
  }

  const [data, quoteDefaults] = await Promise.all([
    getCatalogPageData({
      category: slug,
      page: Number.isNaN(page) ? 1 : page,
    }),
    getQuoteDefaultsForSession(),
  ]);
  const category = data.categories.find((item) => item.slug === slug || item.name === slug);
  const categoryName = category?.name ?? slug;
  const themeVars = {
    "--brand-primary": data.settings.primaryColor,
    "--brand-accent": data.settings.accentColor,
  } as CSSProperties & Record<"--brand-primary" | "--brand-accent", string>;

  return (
    <main className="site-shell" style={themeVars}>
      <PublicStoreHeader
        brands={data.brands}
        categories={data.categories}
      />

      <section className="catalog-section">
        <div className="stack-md">
          <div className="stack-sm">
            <p className="eyebrow">Categoria</p>
            <h1>{categoryName}</h1>
            <p className="muted">
              {data.totalResults} producto{data.totalResults === 1 ? "" : "s"} disponible
              {data.totalResults === 1 ? "" : "s"}.
            </p>
          </div>

          <CartStoreBootstrap />
          {data.products.length ? (
            <div className="catalog-grid">
              {data.products.map((product) => (
                <ProductCard key={product.id} product={product} settings={data.settings} />
              ))}
            </div>
          ) : (
            <section className="empty-state">
              <h2>No hay productos disponibles</h2>
              <p className="muted">Esta categoria no tiene productos visibles con stock por ahora.</p>
              <Link className="button button-secondary" href="/">
                Volver al catalogo
              </Link>
            </section>
          )}
        </div>
      </section>

      {data.totalPages > 1 ? (
        <section className="pagination-row">
          {data.page > 1 ? (
            <Link className="button button-secondary" href={buildCategoryPageHref(slug, data.page - 1)}>
              Pagina anterior
            </Link>
          ) : (
            <span />
          )}
          {data.page < data.totalPages ? (
            <Link className="button button-secondary" href={buildCategoryPageHref(slug, data.page + 1)}>
              Siguiente pagina
            </Link>
          ) : null}
        </section>
      ) : null}

      <StoreSideActions settings={data.settings} />
      <CartDrawer initialOpen={initialCartOpen} quoteDefaults={quoteDefaults} settings={data.settings} />
    </main>
  );
}
