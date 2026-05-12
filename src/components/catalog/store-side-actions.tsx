"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, MessageCircleMore, Search } from "lucide-react";
import { StoreAssistantLauncher } from "@/components/catalog/store-assistant-launcher";
import type { StoreSettingsView } from "@/lib/store";
import { cleanWhatsappNumber } from "@/lib/utils";

type StoreSideActionsProps = {
  settings: Pick<StoreSettingsView, "businessName" | "supportHours" | "whatsappNumber">;
};

export function StoreSideActions({ settings }: StoreSideActionsProps) {
  const pathname = usePathname();
  const isProductPage = pathname.startsWith("/producto/");

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
      {isProductPage ? (
        <Link className="store-side-action store-side-action-back" href="/">
          <ArrowLeft size={20} />
          <span>Catálogo</span>
        </Link>
      ) : null}

      <StoreAssistantLauncher businessName={settings.businessName} />

      <a
        className="store-side-action store-side-action-whatsapp"
        href={`https://wa.me/${cleanWhatsappNumber(settings.whatsappNumber)}`}
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
