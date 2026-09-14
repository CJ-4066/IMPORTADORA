export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  price: number;
  quantity: number;
};

export type PurchasePayload = {
  transaction_id: string;
  value: number;
  currency?: string;
  coupon?: string;
  items: AnalyticsItem[];
};

type DataLayerEvent = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

function pushDataLayer(event: DataLayerEvent) {
  if (typeof window === "undefined") {
    return;
  }

  window.dataLayer?.push(event);
}

export const trackViewItem = (item: AnalyticsItem) => {
  pushDataLayer({
    event: "view_item",
    ecommerce: {
      currency: "PEN",
      value: item.price,
      items: [item],
    },
  });
};

export const trackAddToCart = (item: AnalyticsItem) => {
  pushDataLayer({
    event: "add_to_cart",
    ecommerce: {
      currency: "PEN",
      value: item.price * item.quantity,
      items: [item],
    },
  });
};

export const trackBeginCheckout = (items: AnalyticsItem[], value: number) => {
  pushDataLayer({
    event: "begin_checkout",
    ecommerce: {
      currency: "PEN",
      value,
      items,
    },
  });
};

export const trackPurchase = (payload: PurchasePayload) => {
  pushDataLayer({
    event: "purchase",
    ecommerce: {
      transaction_id: payload.transaction_id,
      value: payload.value,
      currency: payload.currency || "PEN",
      coupon: payload.coupon,
      items: payload.items,
    },
  });
};

export const trackSearch = (searchTerm: string) => {
  pushDataLayer({
    event: "search",
    search_term: searchTerm,
  });
};
