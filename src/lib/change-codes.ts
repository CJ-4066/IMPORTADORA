export const CHANGE_CODES = {
  CATALOG_SELLABLE_RULE: "CAT-001",
  ADMIN_REVIEW_ALERTS: "ADM-002",
  ADMIN_STABLE_PAGINATION: "ADM-003",
  ADMIN_VISIBLE_WITH_PHOTO: "ADM-004",
  ADMIN_MENU_POSITION: "ADM-005",
} as const;

export type ChangeCode = (typeof CHANGE_CODES)[keyof typeof CHANGE_CODES];

export const CHANGE_CODE_NOTES: Record<ChangeCode, string> = {
  [CHANGE_CODES.CATALOG_SELLABLE_RULE]: "Unifica publicación pública: foto real + stock > 0 + visible.",
  [CHANGE_CODES.ADMIN_REVIEW_ALERTS]: "Alertas admin para productos sin foto o sin stock.",
  [CHANGE_CODES.ADMIN_STABLE_PAGINATION]: "Orden estable para paginación server-side.",
  [CHANGE_CODES.ADMIN_VISIBLE_WITH_PHOTO]: "Separa visibles con foto de visibles sin foto.",
  [CHANGE_CODES.ADMIN_MENU_POSITION]: "Menú de acciones del producto renderizado fuera de la tabla.",
};
