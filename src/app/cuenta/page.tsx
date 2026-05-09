import Link from "next/link";
import {
  CalendarDays,
  MessageCircleMore,
  SearchCode,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { requireShopper } from "@/lib/auth";
import { CartDrawer } from "@/components/catalog/cart-drawer";
import { ProductCard } from "@/components/catalog/product-card";
import { PublicStoreHeader } from "@/components/catalog/public-store-header";
import { StoreSideActions } from "@/components/catalog/store-side-actions";
import { getCatalogPageData, getShopperAccount } from "@/lib/store";
import { cleanWhatsappNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ShopperAccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShopperAccountPage({ searchParams }: ShopperAccountPageProps) {
  const session = await requireShopper();
  const params = searchParams ? await searchParams : undefined;
  const initialCartOpen = params?.drawer === "cart";
  const account = await getShopperAccount(session.userId);
  const catalogData = await getCatalogPageData({
    featuredOnly: true,
    page: 1,
  });

  if (!account) {
    return null;
  }

  const featuredProducts = catalogData.products.slice(0, 4);
  const categoryShortcuts = catalogData.categories.slice(0, 6);
  const supportHref = `https://wa.me/${cleanWhatsappNumber(catalogData.settings.whatsappNumber)}`;

  return (
    <main className="site-shell shopper-shell">
      <PublicStoreHeader />

      <section className="panel shopper-account-hero">
        <div className="shopper-account-grid">
          <article className="stack-md">
            <div className="shopper-account-badge">
              <UserRound size={18} />
              <span>Cuenta usershop</span>
            </div>
            <div className="stack-sm">
              <h1>Hola, {account.name}</h1>
              <p className="muted">
                Desde aquí entras a la tienda, revisas ofertas y armas tu pedido sin
                ver datos internos del negocio.
              </p>
            </div>

            <div className="shopper-quick-actions">
              <Link className="button button-secondary" href="/?featured=1">
                <Sparkles size={16} />
                Ver ofertas
              </Link>
              <Link className="button button-ghost" href="/">
                <SearchCode size={16} />
                Seguir comprando
              </Link>
            </div>
          </article>

          <article className="shopper-account-card">
            <div className="shopper-account-row">
              <span>Correo</span>
              <strong>{account.email}</strong>
            </div>
            <div className="shopper-account-row">
              <span>Teléfono</span>
              <strong>{account.phone ?? "No registrado"}</strong>
            </div>
            <div className="shopper-account-row">
              <span>Miembro desde</span>
              <strong>{new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(account.createdAt))}</strong>
            </div>
          </article>
        </div>
      </section>

      <section className="shopper-dashboard-grid">
        <article className="panel shopper-featured-panel">
          <div className="catalog-shortcuts-head">
            <div className="stack-xs">
              <p className="eyebrow">Destacados</p>
              <h2>Productos para comprar hoy</h2>
            </div>
            <Link className="button button-ghost" href="/?featured=1">
              Ver todas las ofertas
            </Link>
          </div>

          {featuredProducts.length ? (
            <div className="catalog-grid shopper-featured-grid">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} settings={catalogData.settings} />
              ))}
            </div>
          ) : (
            <p className="muted">Todavía no hay productos destacados configurados.</p>
          )}
        </article>

        <aside className="panel shopper-support-panel">
          <div className="stack-sm">
            <p className="eyebrow">Soporte de compra</p>
            <h2>Tu acceso rápido</h2>
            <p className="muted">
              Usa tu cuenta para encontrar productos, cargar el carrito y enviar el pedido sin ver
              información interna de operación.
            </p>
          </div>

          <div className="category-shortcuts-grid shopper-category-grid">
            {categoryShortcuts.map((category) => (
              <Link
                className="category-shortcut"
                href={`/?category=${encodeURIComponent(category.slug)}`}
                key={category.id}
              >
                <strong>{category.name}</strong>
                <span>Ir a la categoría</span>
              </Link>
            ))}
          </div>

          <div className="shopper-support-card">
            <div className="shopper-support-row">
              <span>WhatsApp</span>
              <strong>{catalogData.settings.whatsappNumber}</strong>
            </div>
            <div className="shopper-support-row">
              <span>Horario</span>
              <strong>{catalogData.settings.supportHours}</strong>
            </div>
            <a className="button button-primary" href={supportHref} rel="noreferrer" target="_blank">
              <MessageCircleMore size={16} />
              Contactar soporte
            </a>
          </div>
        </aside>
      </section>

      <section className="shopper-utility-grid">
        <article className="panel shopper-utility-card">
          <CalendarDays size={18} />
          <h2>Qué sí puedes ver</h2>
          <p className="muted">
            Catálogo, promociones, búsqueda por código o nombre, carrito y envío de pedido por
            WhatsApp.
          </p>
        </article>

        <article className="panel shopper-utility-card">
          <MessageCircleMore size={18} />
          <h2>Qué no se expone</h2>
          <p className="muted">
            Dashboard, configuración, stock interno, herramientas de edición y toda la operación
            administrativa.
          </p>
        </article>

        <article className="panel shopper-utility-card">
          <ShieldCheck size={18} />
          <h2>Cómo aprovechar esta cuenta</h2>
          <p className="muted">
            Entra, busca por código, agrega productos al carrito y envía el pedido por WhatsApp sin
            llamadas ni pasos extras.
          </p>
        </article>
      </section>

      <StoreSideActions settings={catalogData.settings} />
      <CartDrawer
        initialOpen={initialCartOpen}
        quoteDefaults={{
          email: account.email,
          name: account.name,
          phone: account.phone,
        }}
        settings={catalogData.settings}
      />
    </main>
  );
}
