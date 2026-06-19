"use client";

import {
  Phone,
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
    <Phone
      aria-hidden="true"
      className="store-side-action-whatsapp-icon"
      focusable="false"
      size={24}
      strokeWidth={2.4}
    />
  );
}
