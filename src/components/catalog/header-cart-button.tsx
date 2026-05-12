"use client";

import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/components/catalog/cart-store";
import { STORE_CART_OPEN_EVENT } from "@/components/catalog/cart-events";

export function HeaderCartButton() {
  const itemCount = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  );

  return (
    <button
      className="public-store-quick-link public-store-cart-link"
      aria-label="Carrito"
      onClick={() => window.dispatchEvent(new CustomEvent(STORE_CART_OPEN_EVENT))}
      type="button"
    >
      <ShoppingCart size={16} />
      {itemCount > 0 ? <strong className="public-store-cart-badge">{itemCount}</strong> : null}
    </button>
  );
}
