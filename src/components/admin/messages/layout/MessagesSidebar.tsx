"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Zap, FileCode2, Users, Activity, Settings, Bug } from "lucide-react";

export function MessagesSidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Bandeja", href: "/admin/mensajes", icon: Inbox, exact: true },
    { name: "Automatizaciones", href: "/admin/mensajes/automatizaciones", icon: Zap, exact: false },
    { name: "Plantillas", href: "/admin/mensajes/plantillas", icon: FileCode2, exact: false },
    { name: "Contactos", href: "/admin/mensajes/contactos", icon: Users, exact: false },
    { name: "Actividad", href: "/admin/mensajes/actividad", icon: Activity, exact: false },
    { name: "Simulador", href: "/admin/mensajes/simulador", icon: Bug, exact: false },
    { name: "Configuración", href: "/admin/mensajes/configuracion", icon: Settings, exact: false },
  ];

  return (
    <aside className="messages-app-sidebar">
      <div className="messages-app-sidebar-header">
        <h3>Conversaciones</h3>
      </div>
      <nav className="messages-app-sidebar-nav">
        {navItems.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`messages-app-sidebar-link ${isActive ? "is-active" : ""}`}
            >
              <item.icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
