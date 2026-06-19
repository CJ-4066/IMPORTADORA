"use client";

import {
  ShoppingCart,
} from "lucide-react";
import { STORE_CART_OPEN_EVENT } from "@/components/catalog/cart-events";
import { useCartStore } from "@/components/catalog/cart-store";
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
  void showHomeShortcut;
  void showNormalViewShortcut;

  const itemCount = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  );

  const openCart = () => {
    window.dispatchEvent(new CustomEvent(STORE_CART_OPEN_EVENT));
  };

  return (
    <div className="store-side-actions" aria-label="Accesos rápidos de tienda">
      <button
        aria-label={`Abrir carrito${itemCount > 0 ? `, ${itemCount} productos` : ""}`}
        className="store-side-action store-side-action-cart"
        onClick={openCart}
        type="button"
      >
        <ShoppingCart size={24} />
        {itemCount > 0 ? <strong className="store-side-action-badge">{itemCount}</strong> : null}
        <span>Carrito</span>
      </button>

      <StoreAssistantLauncher businessName={settings.businessName} />

      <a
        className="store-side-action store-side-action-whatsapp"
        href={buildPublicWhatsappHref()}
        rel="noreferrer"
        target="_blank"
        aria-label="Abrir WhatsApp"
      >
        <WhatsAppIcon />
      </a>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <div className="store-side-action-whatsapp-icon" aria-hidden="true">
      <svg viewBox="16 16 32 32" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
        <path
          d="M42.7 21.2A15.5 15.5 0 0 0 20.8 43l-1.7 6.1 6.2-1.7A15.5 15.5 0 1 0 42.7 21.2Zm-3.4 18.6c-.4 1-2.2 1.9-3 2-1 .1-1.9.1-3-.2-.6-.2-1.5-.5-2.5-1-4-1.8-6.8-6-7-6.3-.2-.4-1.7-2.2-1.7-4.1s1-3 1.4-3.4c.4-.4.8-.5 1-.5h.8c.2 0 .5 0 .7.6.3.7 1 2.4 1.1 2.6.1.2.2.5 0 .8-.2.3-.3.5-.5.7-.2.2-.4.5-.6.7-.2.2-.4.4-.1.8.3.4 1.2 1.9 2.7 3.1 1.9 1.5 3.4 2.1 3.8 2.3.4.2.6.2.8 0 .3-.3 1.1-1.2 1.4-1.7.3-.5.6-.4 1-.2.4.2 2.5 1.2 2.9 1.4.4.2.7.3.8.5.1.2.1 1.2-.3 2Z"
          fill="#ffffff"
        />
      </svg>
    </div>
  );
}
