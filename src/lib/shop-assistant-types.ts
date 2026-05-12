export type ShopAssistantQuickAction = {
  label: string;
  href: string;
  accent?: boolean;
};

export type ShopAssistantProductCard = {
  id: string;
  slug: string;
  code: string;
  name: string;
  brand: string | null;
  category: string | null;
  unitPrice: string;
  unitPriceValue: number;
  wholesalePrice: string | null;
  wholesalePriceValue: number | null;
  wholesaleMinQty: number;
  recommendedQuantity?: number;
  recommendationReason?: string;
  unitsPerBox: number | null;
  availabilityLabel: string;
  stockUnits: number;
};

export type ShopAssistantReply = {
  text: string;
  contextProductCode?: string | null;
  contextCategorySlug?: string | null;
  products?: ShopAssistantProductCard[];
  quickActions?: ShopAssistantQuickAction[];
  suggestedPrompts?: string[];
};

export type ShopAssistantRequest = {
  message: string;
  productContextCode?: string | null;
  contextCategorySlug?: string | null;
  recentMessages?: Array<{
    role: "assistant" | "user";
    text: string;
  }>;
};
