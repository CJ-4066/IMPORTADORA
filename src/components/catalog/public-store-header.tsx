import Link from "next/link";
import {
  Battery,
  Bot,
  Car,
  ChevronDown,
  Flame,
  Gamepad2,
  Headphones,
  House,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  MonitorPlay,
  NotebookPen,
  PackageSearch,
  Plane,
  Sparkles,
  Smartphone,
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

function formatCatalogLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (["de", "del", "para", "y", "e", "a", "con", "en"].includes(word) && index > 0) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function normalizeCatalogValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getCategoryPriority(name: string) {
  const normalized = normalizeCatalogValue(name);
  const priorities: Array<[RegExp, number]> = [
    [/auricular|audio/, 10],
    [/parlante/, 20],
    [/celular|telefono|movil/, 30],
    [/smart watch|smartwatch|reloj/, 40],
    [/dispositivos portatiles|tablet|celular/, 50],
    [/periferic|mouse|teclado|gamer/, 60],
    [/bateria|power bank|cargador portatil/, 70],
    [/almacenamiento|memoria|usb/, 80],
    [/entretenimiento|multimedia|consola|proyector|tv/, 90],
    [/camara de seguridad|seguridad/, 100],
    [/auto|carro|vehiculo/, 110],
    [/cocina|utencillo|domestico/, 120],
    [/hogar|iluminacion/, 130],
    [/cuidado personal/, 140],
    [/juguete.*escolar|utiles escolares|articulos escolares/, 150],
    [/equipaje|bolso/, 160],
    [/novedad/, 900],
    [/sexual/, 990],
  ];

  return priorities.find(([pattern]) => pattern.test(normalized))?.[1] ?? 500;
}

function sortCatalogCategories(left: CategoryOption, right: CategoryOption) {
  const priorityDelta = getCategoryPriority(left.name) - getCategoryPriority(right.name);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return formatCatalogLabel(left.name).localeCompare(formatCatalogLabel(right.name), "es");
}

function getCategoryIcon(name: string) {
  const normalized = normalizeCatalogValue(name);

  if (/celular|telefono|m[oó]vil|smart/.test(normalized)) {
    return Smartphone;
  }

  if (/auto|carro|vehiculo/.test(normalized)) {
    return Car;
  }

  if (/hogar|casa|ilumin/.test(normalized)) {
    return normalized.includes("ilumin") ? Lightbulb : House;
  }

  if (/auricular|audio/.test(normalized)) {
    return Headphones;
  }

  if (/bater/i.test(normalized)) {
    return Battery;
  }

  if (/escolar|util|cuaderno|lapic/.test(normalized)) {
    return NotebookPen;
  }

  return PackageSearch;
}

function CategoryShortcutMenu({
  brands,
  categories,
}: {
  brands: BrandOption[];
  categories: CategoryOption[];
}) {
  return (
    <div className="public-store-topline">
      <details className="public-store-shortcut-menu">
        <summary
          aria-label={`Abrir ${categories.length} categorías del catálogo`}
          className="public-store-shortcut is-lead"
        >
          <span className="public-store-lead-icon">
            <Menu size={17} />
          </span>
          <span className="public-store-lead-copy">
            <span>Todas las categorías</span>
            <small>
              {categories.length ? `${categories.length} categorías` : "Explorar catálogo"}
            </small>
          </span>
          <span className="public-store-lead-chevron">
            <ChevronDown size={15} />
          </span>
        </summary>
        <div className="public-store-shortcut-dropdown">
          <div className="public-store-shortcut-dropdown-section">
            <strong>Categorías</strong>
            <div className="public-store-shortcut-dropdown-grid is-categories">
              {categories
                .slice()
                .sort(sortCatalogCategories)
                .map((category) => {
                  const Icon = getCategoryIcon(category.name);

                  return (
                    <CatalogPrefetchLink
                      className="public-store-shortcut-dropdown-link is-category"
                      href={`/?category=${encodeURIComponent(category.slug)}`}
                      key={category.id}
                    >
                      <Icon size={16} />
                      <span>{formatCatalogLabel(category.name)}</span>
                    </CatalogPrefetchLink>
                  );
                })}
            </div>
          </div>
          {brands.length ? (
            <div className="public-store-shortcut-dropdown-section">
              <strong>Marcas</strong>
              <div className="public-store-shortcut-dropdown-grid is-brands">
                {brands.slice(0, 18).map((brand) => (
                  <CatalogPrefetchLink
                    className="public-store-shortcut-dropdown-link"
                    href={`/?brand=${encodeURIComponent(brand.name)}`}
                    key={brand.name}
                  >
                    {formatCatalogLabel(brand.name)}
                  </CatalogPrefetchLink>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </details>
      <div className="public-store-shortcuts" aria-label="Atajos de catálogo">
        {SHORTCUTS.slice(1).map((shortcut) => (
          <CatalogPrefetchLink
            className="public-store-shortcut"
            href={shortcut.href}
            key={shortcut.label}
          >
            {shortcut.icon ? <shortcut.icon size={14} /> : null}
            {shortcut.label}
          </CatalogPrefetchLink>
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
    <header className="public-store-header">
      <div className="public-store-bar">
        <StoreBrand businessName={resolvedSettings.businessName} />
        <HeaderSearch autoFocus={focusSearch} />

        <div className="public-store-actions">
          <AccountSlot role={session?.role} />
          <HeaderCartButton />
        </div>
      </div>

      <CategoryShortcutMenu brands={resolvedBrands} categories={resolvedCategories} />
    </header>
  );
}
