import {
  Bot,
  Flame,
  Gamepad2,
  Menu,
  MonitorPlay,
  PackageSearch,
  Plane,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getBrandOptions, getCategoryOptions } from "@/lib/store";
import type { BrandOption, CategoryOption } from "@/lib/store";
import { CatalogPrefetchLink } from "@/components/catalog/catalog-prefetch-link";
import { HeaderCartButton } from "@/components/catalog/header-cart-button";
import { HeaderSearch } from "@/components/catalog/header-search";
import { PublicStoreHeaderShell } from "@/components/catalog/public-store-header-shell";
import { PublicStoreAccountSlot } from "@/components/catalog/public-store-account-slot";
import { PublicStoreCategoryMenu } from "@/components/catalog/public-store-category-menu";

type Shortcut = {
  label: string;
  href: string;
  icon?: LucideIcon;
  lead?: boolean;
};

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
};

export async function PublicStoreHeader({
  brands,
  categories,
  focusSearch = false,
}: PublicStoreHeaderProps) {
  const session = await getSession();
  const [resolvedCategories, resolvedBrands] = await Promise.all([
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
          <HeaderSearch autoFocus={focusSearch} />

          <div className="public-store-actions">
            <div className="public-store-account-slot">
              <PublicStoreAccountSlot role={session?.role} />
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
