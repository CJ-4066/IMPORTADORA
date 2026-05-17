import type {
  ErpSyncStatus,
  ErpSyncTrigger,
  QuoteStatus,
  TrendDirection,
  TrendPeriod,
} from "@prisma/client";

export type CatalogProduct = {
  id: string;
  code: string;
  slug: string;
  name: string;
  description: string | null;
  technicalSpecs: string | null;
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
  hasPhoto: boolean;
  lastSyncedAt: string | null;
  updatedAt: string;
};

export type AdminProductListItem = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  unitPrice: number;
  wholesalePrice: number | null;
  stockUnits: number;
  isVisible: boolean;
  isFeatured: boolean;
  hasPhoto: boolean;
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

export type CatalogSalesInsight = {
  label: string;
  value: string;
};

export type CatalogSalesSummary = {
  generatedAt: string | null;
  hasDatedSales: boolean;
  hasRealSales: boolean;
  hasUnitSales: boolean;
  insights: CatalogSalesInsight[];
  source: "erp" | "fallback";
};

export type ShopperAccountView = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
};

export type ShopperQuoteItemView = {
  code: string;
  name: string;
  quantity: number;
  total: number;
};

export type ShopperQuoteView = {
  id: string;
  quoteNumber: string | null;
  status: QuoteStatus;
  total: number;
  currencySymbol: string;
  createdAt: string;
  itemCount: number;
  items: ShopperQuoteItemView[];
};

export type ShopperQuoteDetailItemView = ShopperQuoteItemView & {
  tierLabel: string;
  unitPrice: number;
  product: CatalogProduct | null;
};

export type ShopperQuoteDetailView = Omit<ShopperQuoteView, "items"> & {
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string | null;
  customerDocumentNumber: string | null;
  customerDocumentType: string | null;
  errorMessage: string | null;
  items: ShopperQuoteDetailItemView[];
  note: string | null;
  statusSteps: AdminQuoteStatusStepView[];
  updatedAt: string;
  whatsappHref: string | null;
};

export type AdminQuoteItemView = ShopperQuoteItemView & {
  code: string;
};

export type AdminQuoteDetailItemView = AdminQuoteItemView & {
  externalId: string | null;
  productId: string | null;
  tierLabel: string;
  unitPrice: number;
};

export type AdminQuoteStatusStepView = {
  status: "success" | "warning" | "error";
  text: string;
};

export type AdminQuotePdfNotificationView = {
  message: string;
  ok: boolean;
  sent: boolean;
} | null;

export type AdminQuoteView = {
  id: string;
  quoteNumber: string | null;
  status: QuoteStatus;
  total: number;
  currencySymbol: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  erpCustomerMode: string | null;
  createdAt: string;
  itemCount: number;
  items: AdminQuoteItemView[];
  user: {
    name: string;
    email: string;
  } | null;
};

export type AdminQuoteDetailView = Omit<AdminQuoteView, "items" | "itemCount"> & {
  customerAddress: string | null;
  customerDocumentNumber: string | null;
  customerDocumentType: string | null;
  erpCustomerId: number | null;
  erpExternalId: string | null;
  errorMessage: string | null;
  itemCount: number;
  items: AdminQuoteDetailItemView[];
  note: string | null;
  pdfNotification: AdminQuotePdfNotificationView;
  statusSteps: AdminQuoteStatusStepView[];
  updatedAt: string;
  whatsappHref: string | null;
};

export type AdminQuotesData = {
  quotes: AdminQuoteView[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalResults: number;
  stats: {
    all: number;
    pending: number;
    registered: number;
    error: number;
  };
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
  hiddenWithoutPhotoProducts: number;
  visibleWithoutPhotoProducts: number;
  needsReviewProducts: number;
  productsWithoutPhoto: number;
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
