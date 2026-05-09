"use client";

import { useEffect } from "react";
import { rehydrateCartStore } from "@/components/catalog/cart-store";

export function CartStoreBootstrap() {
  useEffect(() => {
    void rehydrateCartStore();
  }, []);

  return null;
}
