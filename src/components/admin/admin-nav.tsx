"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombined,
  DatabaseZap,
  FileText,
  FolderTree,
  ImagePlus,
  LogOut,
  MessageSquareHeart,
  PackagePlus,
  PackageSearch,
  ShieldAlert,
  UsersRound,
  Store,
} from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

type AdminNavLink = {
  href?: string;
  label: string;
  icon: typeof ChartNoAxesCombined;
  kind?: "link" | "action";
};

type AdminNavSection = {
  title: string;
  links: AdminNavLink[];
};

const sections: AdminNavSection[] = [
  {
    title: "Acceso",
    links: [
      { href: "/", label: "Ver catálogo", icon: Store, kind: "link" },
      { label: "Cerrar sesión", icon: LogOut, kind: "action" },
    ],
  },
  {
    title: "General",
    links: [
      { href: "/admin", label: "Dashboard", icon: ChartNoAxesCombined },
      { href: "/admin/users", label: "Usuarios", icon: UsersRound },
    ],
  },
  {
    title: "Catálogo",
    links: [
      { href: "/admin/products", label: "Productos", icon: PackageSearch },
      { href: "/admin/categories", label: "Categorías", icon: FolderTree },
      { href: "/admin/products/new", label: "Nuevo producto", icon: PackagePlus },
    ],
  },
  {
    title: "Ventas",
    links: [{ href: "/admin/quotes", label: "Cotizaciones", icon: FileText }],
  },
  {
    title: "Marketing",
    links: [{ href: "/admin/banners", label: "Banners y campañas", icon: ImagePlus }],
  },
  {
    title: "Atención",
    links: [
      { href: "/admin/opiniones", label: "Opiniones", icon: MessageSquareHeart },
      { href: "/admin/reclamos", label: "Reclamos", icon: ShieldAlert },
    ],
  },
  {
    title: "ERP",
    links: [{ href: "/admin/erp", label: "Sincronización ERP", icon: DatabaseZap }],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Navegación administrativa">
      {sections.map((section) => (
        <section className="admin-nav-section" key={section.title}>
          <p className="admin-nav-section-title">{section.title}</p>
          <div className="admin-nav-links">
            {section.links.map((link) => {
              const Icon = link.icon;
              const isLink = link.kind !== "action" && Boolean(link.href);
              const isActive =
                isLink &&
                (pathname === link.href ||
                  (link.href !== "/admin" && pathname.startsWith(`${link.href}/`)));

              if (link.kind === "action") {
                return (
                  <form action={logoutAction} key={link.label}>
                    <button className="admin-nav-link admin-nav-button" type="submit">
                      <span className="admin-nav-icon">
                        <Icon size={18} />
                      </span>
                      <span>{link.label}</span>
                    </button>
                  </form>
                );
              }

              if (!link.href) {
                return null;
              }

              return (
                <Link
                  key={link.href}
                  className={cn(
                    "admin-nav-link",
                    isActive && "is-active",
                  )}
                  href={link.href}
                >
                  <span className="admin-nav-icon">
                    <Icon size={18} />
                  </span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
