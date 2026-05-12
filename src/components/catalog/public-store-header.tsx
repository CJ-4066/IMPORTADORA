import Link from "next/link";
import {
  Bot,
  Flame,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorPlay,
  PackageSearch,
  Plane,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { getSession } from "@/lib/auth";
import { getBrandOptions, getCategoryOptions, getStoreSettings } from "@/lib/store";
import type { BrandOption, CategoryOption, StoreSettingsView } from "@/lib/store";
import { shopperLogoutAction } from "@/app/acceso/actions";
import { CatalogPrefetchLink } from "@/components/catalog/catalog-prefetch-link";
import { HeaderCartButton } from "@/components/catalog/header-cart-button";
import { HeaderSearch } from "@/components/catalog/header-search";
import { PublicStoreHeaderShell } from "@/components/catalog/public-store-header-shell";
import { PublicStoreCategoryMenu } from "@/components/catalog/public-store-category-menu";

type Shortcut = {
  label: string;
  href: string;
  icon?: LucideIcon;
  lead?: boolean;
};

type AccountLinkItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type AccountRole = SessionUser["role"] | undefined;

const SHORTCUTS: Shortcut[] = [
  { label: "Todas las categorías", href: "/", lead: true, icon: Menu },
  { label: "Productos más vendidos", href: "/?collection=mas-vendidos", icon: PackageSearch },
  { label: "Ofertas", href: "/?collection=ofertas", icon: Flame },
  { label: "Preventa", href: "/?collection=preventa", icon: Sparkles },
  { label: "Proyectores", href: "/?collection=proyectores", icon: MonitorPlay },
  { label: "Drones", href: "/?collection=drones", icon: Plane },
  { label: "Alexas", href: "/?collection=alexas", icon: Bot },
  { label: "Consolas de videojuego", href: "/?collection=consolas", icon: Gamepad2 },
];

function AccountPopover({ canLogout = false, items }: { canLogout?: boolean; items: AccountLinkItem[] }) {
  return (
    <details className="account-popover public-store-account-popover">
      <summary className="public-store-quick-link account-popover-trigger">
        <UserRound size={16} />
        <span>Mi cuenta</span>
      </summary>

      <div className="account-popover-menu">
        {items.map((item) => (
          <Link className="account-popover-link" href={item.href} key={item.href}>
            <item.icon size={16} />
            {item.label}
          </Link>
        ))}

        {canLogout ? (
          <form action={shopperLogoutAction}>
            <button className="account-popover-link account-popover-button" type="submit">
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </form>
        ) : null}
      </div>
    </details>
  );
}

function AccountSlot({ role }: { role?: AccountRole }) {
  if (role === "ADMIN") {
    return (
      <Link className="public-store-quick-link" href="/admin">
        <LayoutDashboard size={16} />
        <span>Panel admin</span>
      </Link>
    );
  }

  if (role === "USERSHOP") {
    return (
      <AccountPopover
        canLogout
        items={[{ label: "Mi cuenta", href: "/cuenta", icon: UserRound }]}
      />
    );
  }

  return (
    <AccountPopover
      items={[
        { label: "Iniciar sesión", href: "/acceso?mode=login", icon: UserRound },
        { label: "Crear cuenta", href: "/acceso?mode=register", icon: UserRound },
      ]}
    />
  );
}

function StoreBrand({ businessName }: { businessName: string }) {
  return (
    <Link className="public-store-brand" href="/">
      <div className="public-store-wordmark">
        <strong>{businessName}</strong>
        <span>Catálogo mayorista</span>
      </div>
    </Link>
  );
}

function CategoryShortcutMarquee() {
  const items = SHORTCUTS.slice(1);

  return (
    <div className="public-store-shortcuts-marquee" aria-label="Atajos de catálogo">
      <div className="public-store-shortcuts-marquee-track">
        {[0, 1].map((group) => (
          <div className="public-store-shortcuts-marquee-group" aria-hidden={group === 1} key={group}>
            {items.map((shortcut) => (
              <CatalogPrefetchLink
                className="public-store-shortcut"
                href={shortcut.href}
                tabIndex={group === 1 ? -1 : undefined}
                key={`${group}-${shortcut.label}`}
              >
                {shortcut.icon ? <shortcut.icon size={14} /> : null}
                {shortcut.label}
              </CatalogPrefetchLink>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type PublicStoreHeaderProps = {
  brands?: BrandOption[];
  categories?: CategoryOption[];
  focusSearch?: boolean;
  settings?: StoreSettingsView;
};

export async function PublicStoreHeader({
  brands,
  categories,
  focusSearch = false,
  settings,
}: PublicStoreHeaderProps) {
  const session = await getSession();
  const [resolvedSettings, resolvedCategories, resolvedBrands] = await Promise.all([
    settings ? Promise.resolve(settings) : getStoreSettings(),
    categories ? Promise.resolve(categories) : getCategoryOptions(),
    brands ? Promise.resolve(brands) : getBrandOptions(),
  ]);

  return (
    <PublicStoreHeaderShell>
      <header className="public-store-header">
        <div className="public-store-bar">
          <div className="public-store-desktop-category-slot">
            <PublicStoreCategoryMenu brands={resolvedBrands} categories={resolvedCategories} />
          </div>
          <div className="public-store-mobile-category-slot">
            <PublicStoreCategoryMenu brands={resolvedBrands} categories={resolvedCategories} />
          </div>
          <StoreBrand businessName={resolvedSettings.businessName} />
          <HeaderSearch autoFocus={focusSearch} />

          <div className="public-store-actions">
            <div className="public-store-account-slot">
              <AccountSlot role={session?.role} />
            </div>
            <HeaderCartButton />
          </div>
        </div>

        <div className="public-store-desktop-shortcuts">
          <div className="public-store-topline">
            <CategoryShortcutMarquee />
          </div>
        </div>
        <div className="public-store-mobile-marquee">
          <CategoryShortcutMarquee />
        </div>
      </header>
    </PublicStoreHeaderShell>
  );
}
