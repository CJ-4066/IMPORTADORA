"use client";

export const STORE_ASSISTANT_OPEN_EVENT = "catalog:open-assistant";

export type StoreAssistantOpenDetail = {
  prompt: string;
  productContextCode?: string | null;
  contextCategorySlug?: string | null;
};

