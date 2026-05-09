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
import { shopperLogoutAction } from "@/app/acceso/actions";
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

function getCategoryIcon(name: string) {
  const normalized = name.toLowerCase();

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
  brands: Awaited<ReturnType<typeof getBrandOptions>>;
  categories: Awaited<ReturnType<typeof getCategoryOptions>>;
}) {
  return (
    <div className="public-store-topline">
      <details className="public-store-shortcut-menu">
        <summary className="public-store-shortcut is-lead">
          <Menu size={15} />
          Todas las categorías
          <ChevronDown size={14} />
        </summary>
        <div className="public-store-shortcut-dropdown">
          <div className="public-store-shortcut-dropdown-section">
            <strong>Categorías</strong>
            <div className="public-store-shortcut-dropdown-grid is-categories">
              {categories
                .slice()
                .sort((left, right) => formatCatalogLabel(left.name).localeCompare(formatCatalogLabel(right.name), "es"))
                .map((category) => {
                  const Icon = getCategoryIcon(category.name);

                  return (
                    <Link
                      className="public-store-shortcut-dropdown-link is-category"
                      href={`/?category=${encodeURIComponent(category.slug)}`}
                      key={category.id}
                    >
                      <Icon size={16} />
                      <span>{formatCatalogLabel(category.name)}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
          {brands.length ? (
            <div className="public-store-shortcut-dropdown-section">
              <strong>Marcas</strong>
              <div className="public-store-shortcut-dropdown-grid is-brands">
                {brands.slice(0, 18).map((brand) => (
                  <Link
                    className="public-store-shortcut-dropdown-link"
                    href={`/?brand=${encodeURIComponent(brand.name)}`}
                    key={brand.name}
                  >
                    {formatCatalogLabel(brand.name)}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </details>
      <div className="public-store-shortcuts" aria-label="Atajos de catálogo">
        {SHORTCUTS.slice(1).map((shortcut) => (
          <Link className="public-store-shortcut" href={shortcut.href} key={shortcut.label}>
            {shortcut.icon ? <shortcut.icon size={14} /> : null}
            {shortcut.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export async function PublicStoreHeader({ focusSearch = false }: { focusSearch?: boolean }) {
  const session = await getSession();
  const [settings, categories, brands] = await Promise.all([
    getStoreSettings(),
    getCategoryOptions(),
    getBrandOptions(),
  ]);

  return (
    <header className="public-store-header">
      <div className="public-store-bar">
        <StoreBrand businessName={settings.businessName} />
        <HeaderSearch autoFocus={focusSearch} />

        <div className="public-store-actions">
          <AccountSlot role={session?.role} />
          <HeaderCartButton />
        </div>
      </div>

      <CategoryShortcutMenu brands={brands} categories={categories} />
    </header>
  );
}
