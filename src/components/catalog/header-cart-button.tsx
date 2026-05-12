"use client";

import { ShoppingCart } from "lucide-react";
import { STORE_CART_OPEN_EVENT } from "@/components/catalog/cart-events";

export function HeaderCartButton() {
  return (
    <button
      className="public-store-quick-link public-store-cart-link"
      aria-label="Carrito"
      onClick={() => window.dispatchEvent(new CustomEvent(STORE_CART_OPEN_EVENT))}
      type="button"
    >
      <ShoppingCart size={16} />
    </button>
  );
}
