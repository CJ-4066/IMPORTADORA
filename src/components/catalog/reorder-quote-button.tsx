"use client";

import { RotateCcw } from "lucide-react";
import { STORE_CART_OPEN_EVENT } from "@/components/catalog/cart-events";
import {
  isCartStoreHydrated,
  rehydrateCartStore,
  useCartStore,
} from "@/components/catalog/cart-store";
import type { CatalogProduct } from "@/lib/store";

type ReorderQuoteItem = {
  product: CatalogProduct;
  quantity: number;
};

type ReorderQuoteButtonProps = {
  className?: string;
  disabledLabel?: string;
  items: ReorderQuoteItem[];
  label?: string;
};

export function ReorderQuoteButton({
  className = "button button-primary",
  disabledLabel = "Sin stock disponible",
  items,
  label = "Comprar de nuevo",
}: ReorderQuoteButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const availableItems = items.filter((item) => item.product.stockUnits > 0 && item.quantity > 0);

  const handleReorder = async () => {
    if (!availableItems.length) {
      return;
    }

    if (!isCartStoreHydrated()) {
      await rehydrateCartStore();
    }

    for (const item of availableItems) {
      addItem(item.product, "unit", item.quantity);
    }

    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(STORE_CART_OPEN_EVENT));
    });
  };

  return (
    <button
      className={className}
      disabled={!availableItems.length}
      onClick={() => void handleReorder()}
      type="button"
    >
      <RotateCcw size={16} />
      {availableItems.length ? label : disabledLabel}
    </button>
  );
}
