"use client";

import { useEffect } from "react";
import { ShoppingCart } from "lucide-react";
import { STORE_CART_OPEN_EVENT } from "@/components/catalog/cart-events";
import { rehydrateCartStore, useCartStore } from "@/components/catalog/cart-store";

export function HeaderCartButton() {
  const { items, hydrated } = useCartStore();

  useEffect(() => {
    rehydrateCartStore();
  }, []);

  const totalItems = hydrated ? items.reduce((sum, item) => sum + item.quantity, 0) : 0;

  return (
    <button
      className="public-store-quick-link public-store-cart-link"
      onClick={() => window.dispatchEvent(new CustomEvent(STORE_CART_OPEN_EVENT))}
      type="button"
    >
      <ShoppingCart size={16} />
      <span>Carrito</span>
      <strong>{totalItems}</strong>
    </button>
  );
}
