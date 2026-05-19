"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombined,
  DatabaseZap,
  FileText,
  FolderTree,
  PackagePlus,
  PackageSearch,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AdminNavLink = {
  href: string;
  label: string;
  icon: typeof ChartNoAxesCombined;
};

type AdminNavSection = {
  title: string;
  links: AdminNavLink[];
};

const sections: AdminNavSection[] = [
  {
    title: "General",
    links: [{ href: "/admin", label: "Dashboard", icon: ChartNoAxesCombined }],
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
    title: "Atención",
    links: [{ href: "/admin/reclamos", label: "Reclamos", icon: ShieldAlert }],
  },
  {
    title: "ERP",
    links: [{ href: "/admin/erp", label: "Sincronización ERP", icon: DatabaseZap }],
  },
  {
    title: "Configuración",
    links: [{ href: "/admin/settings", label: "Ajustes globales", icon: Settings2 }],
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

              return (
                <Link
                  key={link.href}
                  className={cn(
                    "admin-nav-link",
                    (pathname === link.href ||
                      (link.href !== "/admin" && pathname.startsWith(`${link.href}/`))) &&
                      "is-active",
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
