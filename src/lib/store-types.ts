import type { ErpSyncStatus, ErpSyncTrigger, TrendDirection, TrendPeriod } from "@prisma/client";

export type CatalogProduct = {
  id: string;
  code: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  categoryId: string | null;
  imageUrl: string | null;
  media: ProductMediaView[];
  primaryMedia: ProductMediaView | null;
  unitLabel: string;
  unitPrice: number;
  wholesalePrice: number | null;
  wholesaleMinQty: number;
  boxPrice: number | null;
  unitsPerBox: number | null;
  stockUnits: number;
  isVisible: boolean;
  isFeatured: boolean;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  updatedAt: string;
};

export type ProductMediaView = {
  id: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  altText: string | null;
  sortOrder: number;
};

export type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

export type BrandOption = {
  name: string;
};

export type CatalogSuggestion = {
  id: string;
  slug: string;
  code: string;
  name: string;
  brand: string | null;
  category: string | null;
};

export type AdminCategory = CategoryOption & {
  productCount: number;
};

export type HeroSlideView = {
  imageUrl: string;
  title: string | null;
  text: string | null;
};

export type StoreSettingsView = {
  businessName: string;
  heroTitle: string;
  heroDescription: string;
  heroSlides: HeroSlideView[];
  heroAutoplaySeconds: number;
  whatsappNumber: string;
  orderIntro: string;
  orderFooter: string;
  currencySymbol: string;
  highlightMessage: string;
  supportHours: string;
  primaryColor: string;
  accentColor: string;
};

export type ShopperAccountView = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
};

export type DashboardTrendProduct = {
  code: string;
  name: string;
  unitsSold: number;
  deltaPercent: number;
  momentumScore: number;
  direction: TrendDirection;
};

export type DashboardPeriod = TrendPeriod;

export type DashboardComparisonMetric = {
  label: string;
  currentValue: number;
  previousValue: number | null;
  deltaPercent: number | null;
};

export type DashboardDataFreshness = {
  sourceLabel: string;
  lastSyncAt: string | null;
  lastSyncStatus: ErpSyncStatus | null;
  syncedProducts: number;
  neverSyncedProducts: number;
  staleSyncedProducts: number;
  outOfStockProducts: number;
  hiddenOutOfStockProducts: number;
  visibleOutOfStockProducts: number;
};

export type ErpSyncLogView = {
  id: string;
  source: string;
  trigger: ErpSyncTrigger;
  status: ErpSyncStatus;
  fetchedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorMessage: string | null;
  cancelRequestedAt: string | null;
  initiatedByName: string | null;
  initiatedByEmail: string | null;
  canceledByName: string | null;
  canceledByEmail: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
};
