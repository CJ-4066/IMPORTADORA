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
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard", icon: ChartNoAxesCombined },
  { href: "/admin/products", label: "Productos", icon: PackageSearch },
  { href: "/admin/quotes", label: "Cotizaciones", icon: FileText },
  { href: "/admin/categories", label: "Categorías", icon: FolderTree },
  { href: "/admin/settings#erp-sync", label: "ERP", icon: DatabaseZap },
  { href: "/admin/products/new", label: "Nuevo producto", icon: PackagePlus },
  { href: "/admin/settings", label: "Configuración", icon: Settings2 },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      {links.map((link) => (
        (() => {
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
        })()
      ))}
    </nav>
  );
}
