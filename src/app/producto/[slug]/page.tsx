import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CartDrawer } from "@/components/catalog/cart-drawer";
import { ProductCard } from "@/components/catalog/product-card";
import { ProductDetailView } from "@/components/catalog/product-detail-view";
import { PublicStoreHeader } from "@/components/catalog/public-store-header";
import { StoreSideActions } from "@/components/catalog/store-side-actions";
import { getQuoteDefaultsForSession } from "@/lib/quote-profile";
import { getCatalogProductBySlug } from "@/lib/store";

type ProductDetailPageProps = {
  params?: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
  searchParams,
}: ProductDetailPageProps) {
  const routeParams = params ? await params : undefined;
  const queryParams = searchParams ? await searchParams : undefined;
  const slug = routeParams?.slug;
  const initialCartOpen = queryParams?.drawer === "cart";

  if (!slug) {
    notFound();
  }

  const [data, quoteDefaults] = await Promise.all([
    getCatalogProductBySlug(slug),
    getQuoteDefaultsForSession(),
  ]);

  if (!data) {
    notFound();
  }

  const themeVars = {
    "--brand-primary": data.settings.primaryColor,
    "--brand-accent": data.settings.accentColor,
  } as CSSProperties & Record<"--brand-primary" | "--brand-accent", string>;
  const isAvailable = data.product.isVisible && data.product.stockUnits > 0 && data.product.syncEnabled;

  return (
    <main className="site-shell" style={themeVars}>
      <PublicStoreHeader />

      {isAvailable ? (
        <ProductDetailView key={data.product.slug} product={data.product} settings={data.settings} />
      ) : (
        <section className="panel product-unavailable-panel">
          <div className="stack-md">
            <div className="stack-xs">
              <p className="eyebrow">Producto no disponible</p>
              <h1>{data.product.name}</h1>
              <p className="muted">
                Este producto existe en el sistema, pero no está disponible para compra en este momento.
              </p>
            </div>

            <div className="product-unavailable-actions">
              <Link className="button button-secondary" href="/">
                Volver al catálogo
              </Link>
              <Link className="button button-primary" href="/?focus=search">
                Buscar otro producto
              </Link>
            </div>
          </div>
        </section>
      )}

      {isAvailable && data.relatedProducts.length ? (
        <section className="panel related-products-panel">
          <div className="stack-sm">
            <p className="eyebrow">Sigue explorando</p>
            <h2>Productos relacionados</h2>
            <p className="muted">Más opciones dentro de la misma línea para completar el pedido.</p>
          </div>

          <div className="catalog-grid">
            {data.relatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} settings={data.settings} />
            ))}
          </div>
        </section>
      ) : null}

      <StoreSideActions settings={data.settings} />
      <CartDrawer initialOpen={initialCartOpen} quoteDefaults={quoteDefaults} settings={data.settings} />
    </main>
  );
}
