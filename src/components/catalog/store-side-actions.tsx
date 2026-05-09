"use client";

import { usePathname } from "next/navigation";
import { MessageCircleMore, Search } from "lucide-react";
import { StoreAssistant } from "@/components/catalog/store-assistant";
import type { StoreSettingsView } from "@/lib/store";
import { cleanWhatsappNumber } from "@/lib/utils";

type StoreSideActionsProps = {
  settings: Pick<StoreSettingsView, "businessName" | "supportHours" | "whatsappNumber">;
};

export function StoreSideActions({ settings }: StoreSideActionsProps) {
  const pathname = usePathname();

  const handleSearch = () => {
    const headerInput = document.getElementById(
      "store-header-search-input",
    ) as HTMLInputElement | null;

    if (headerInput) {
      headerInput.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        headerInput.focus();
        headerInput.select();
      }, 260);
      return;
    }

    if (pathname !== "/") {
      window.location.href = "/?focus=search";
      return;
    }

    window.location.href = "/?focus=search";
  };

  return (
    <div className="store-side-actions" aria-label="Accesos rápidos de tienda">
      <StoreAssistant businessName={settings.businessName} />

      <a
        className="store-side-action store-side-action-whatsapp"
        href={`https://wa.me/${cleanWhatsappNumber(settings.whatsappNumber)}`}
        rel="noreferrer"
        target="_blank"
      >
        <MessageCircleMore size={20} />
        <span>WhatsApp</span>
      </a>

      <button className="store-side-action" onClick={handleSearch} type="button">
        <Search size={20} />
        <span>Buscar</span>
      </button>
    </div>
  );
}
