"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { House, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { shopperLogoutAction } from "@/app/acceso/actions";
import type { SessionUser } from "@/lib/auth";
import { usePublicStoreHeaderState } from "@/components/catalog/public-store-header-shell";

type AccountRole = SessionUser["role"] | undefined;

type AccountLinkItem = {
  label: string;
  href: string;
  icon: typeof UserRound;
};

function AccountPopover({
  canLogout = false,
  items,
  triggerLabel,
}: {
  canLogout?: boolean;
  items: AccountLinkItem[];
  triggerLabel: string;
}) {
  return (
    <details className="account-popover public-store-account-popover">
      <summary className="public-store-quick-link account-popover-trigger">
        <UserRound size={16} />
        <span>{triggerLabel}</span>
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

export function PublicStoreAccountSlot({ role }: { role?: AccountRole }) {
  const { collapsed } = usePublicStoreHeaderState();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasQueryParams = searchParams.toString().length > 0;

  const handleStartClick = () => {
    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className={`public-store-account-switch${collapsed ? " is-collapsed" : ""}`}>
      <div className="public-store-account-switch-layer is-expanded" aria-hidden={collapsed}>
        {role === "ADMIN" ? (
          <Link className="public-store-quick-link public-store-account-switch-link" href="/admin">
            <LayoutDashboard size={16} />
            <span>Panel admin</span>
          </Link>
        ) : role === "USERSHOP" ? (
          <AccountPopover
            canLogout
            triggerLabel="Mi cuenta"
            items={[{ label: "Mi cuenta", href: "/cuenta", icon: UserRound }]}
          />
        ) : (
          <AccountPopover
            triggerLabel="Login"
            items={[
              { label: "Login", href: "/acceso?mode=login", icon: UserRound },
              { label: "Crear cuenta", href: "/acceso?mode=register", icon: UserRound },
            ]}
          />
        )}
      </div>

      <div className="public-store-account-switch-layer is-collapsed" aria-hidden={!collapsed}>
        {pathname === "/" && !hasQueryParams ? (
          <button
            className="public-store-quick-link public-store-cart-link public-store-home-link public-store-account-switch-link"
            type="button"
            aria-label="Volver al inicio"
            onClick={handleStartClick}
          >
            <House size={16} />
            <span>Inicio</span>
          </button>
        ) : (
          <Link
            className="public-store-quick-link public-store-cart-link public-store-home-link public-store-account-switch-link"
            href="/"
            aria-label="Volver al inicio"
          >
            <House size={16} />
            <span>Inicio</span>
          </Link>
        )}
      </div>
    </div>
  );
}
