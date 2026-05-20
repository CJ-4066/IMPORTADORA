export type FacturadorRecord = Record<string, unknown>;

export type FacturadorProduct = FacturadorRecord;

export type FacturadorCategory = FacturadorRecord;

export type FacturadorBrand = FacturadorRecord;

export type FacturadorCustomer = FacturadorRecord;

export type FacturadorSalesProduct = FacturadorRecord;

export type FacturadorQuoteCustomer = {
  name: string;
  phone: string;
  email?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  address?: string | null;
};

export type FacturadorQuotationResult = {
  response: unknown;
  customerMode: "default" | "existing" | "created";
  customerId: number;
  customerName: string;
  customerDocumentNumber: string | null;
  warnings: string[];
};

export type FacturadorConfig = {
  baseUrl: string;
  token: string;
  source: string;
  quotationPath: string | null;
  quotationPrefix: string;
  timeoutMs: number;
  startProductPage: number;
  maxProductPages: number | null;
  productPageConcurrency: number;
  productPageDelayMs: number;
  maxRetries: number;
  retryDelayMs: number;
  hideMissingProducts: boolean;
  runningSyncTimeoutMs: number;
  productUpdatedSinceParam: string | null;
  productUpdatedSinceFormat: "iso" | "date" | "unix-ms" | "unix-seconds";
};

export type FacturadorQuoteItem = {
  code: string;
  externalId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type SyncableProduct = {
  code: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  categoryId: string | null;
  imageUrl: string | null;
  unitLabel: string;
  unitPrice: number;
  wholesalePrice: number | null;
  wholesaleMinQty: number;
  boxPrice: number | null;
  unitsPerBox: number | null;
  stockUnits: number;
  isVisible: boolean;
  isFeatured: boolean;
  externalSource: string;
  externalId: string;
  externalCode: string | null;
  syncEnabled: boolean;
  lastSyncedAt: Date;
  syncHash?: string | null;
  syncQuickHash?: string | null;
};

export type ProductMapResult =
  | {
      ok: true;
      product: SyncableProduct;
      categoryName: string | null;
    }
  | {
      ok: false;
      reason: string;
      externalId: string | null;
    };
