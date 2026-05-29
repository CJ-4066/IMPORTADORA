"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  House,
  LayoutGrid,
  MessageCircleMore,
  Search,
} from "lucide-react";
import { StoreAssistantLauncher } from "@/components/catalog/store-assistant-launcher";
import type { StoreSettingsView } from "@/lib/store";
import { buildPublicWhatsappHref } from "@/lib/utils";

type StoreSideActionsProps = {
  settings: Pick<StoreSettingsView, "businessName" | "supportHours" | "whatsappNumber">;
  showHomeShortcut?: boolean;
  showNormalViewShortcut?: boolean;
};

export function StoreSideActions({
  settings,
  showHomeShortcut = false,
  showNormalViewShortcut = false,
}: StoreSideActionsProps) {
  const pathname = usePathname();
  const isProductPage = pathname.startsWith("/producto/");
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  useEffect(() => {
    const updateScrollState = () => {
      setIsScrolledDown(window.scrollY > 180);
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScrollState);
    };
  }, []);

  const handleSearch = () => {
    window.dispatchEvent(new CustomEvent("catalog:focus-search"));

    if (pathname !== "/") {
      window.location.href = "/?focus=search";
    }
  };

  return (
    <div
      className={`store-side-actions${isProductPage ? " store-side-actions-product" : ""}`}
      aria-label="Accesos rápidos de tienda"
    >
      {showHomeShortcut ? (
        <Link
          aria-label="Ir al inicio"
          className="store-side-action store-side-action-home"
          href="/"
          scroll
        >
          <House size={20} />
          <span>Inicio</span>
        </Link>
      ) : isScrolledDown ? (
        <button
          aria-label="Subir al inicio"
          className="store-side-action store-side-action-home"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          type="button"
        >
          <ArrowUp size={20} />
          <span>Subir</span>
        </button>
      ) : null}

      {showNormalViewShortcut ? (
        <Link
          aria-label="Reducir vista"
          className="store-side-action store-side-action-home"
          href="/"
          scroll
        >
          <LayoutGrid size={20} />
          <span>Reducir</span>
        </Link>
      ) : null}

      {isProductPage ? (
        <Link className="store-side-action store-side-action-back" href="/">
          <ArrowLeft size={20} />
          <span>Catálogo</span>
        </Link>
      ) : null}

      <StoreAssistantLauncher businessName={settings.businessName} />

      <a
        className="store-side-action store-side-action-whatsapp"
        href={buildPublicWhatsappHref()}
        rel="noreferrer"
        target="_blank"
        aria-label="Abrir WhatsApp"
      >
        <MessageCircleMore size={20} />
        <span>WhatsApp</span>
      </a>

      <button
        aria-label="Buscar productos"
        className="store-side-action store-side-action-search"
        onClick={handleSearch}
        type="button"
      >
        <Search size={20} />
        <span>Buscar</span>
      </button>
    </div>
  );
}
