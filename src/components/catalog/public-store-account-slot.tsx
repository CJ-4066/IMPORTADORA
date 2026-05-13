"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { shopperLogoutAction } from "@/app/acceso/actions";
import type { SessionUser } from "@/lib/auth";

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
        triggerLabel="Mi cuenta"
        items={[{ label: "Mi cuenta", href: "/cuenta", icon: UserRound }]}
      />
    );
  }

  return (
    <AccountPopover
      triggerLabel="Login"
      items={[
        { label: "Login", href: "/acceso?mode=login", icon: UserRound },
        { label: "Crear cuenta", href: "/acceso?mode=register", icon: UserRound },
      ]}
    />
  );
}
