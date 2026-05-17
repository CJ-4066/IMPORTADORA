export type ProductMediaFormValue = {
  type: "IMAGE" | "VIDEO";
  url: string;
  altText: string;
};

export type ProductFormValues = {
  code: string;
  name: string;
  brand: string;
  categoryId: string;
  description: string;
  technicalSpecs: string;
  imageUrl: string;
  media: ProductMediaFormValue[];
  unitLabel: string;
  stockUnits: string;
  unitPrice: string;
  wholesalePrice: string;
  wholesaleMinQty: string;
  boxPrice: string;
  unitsPerBox: string;
  isVisible: boolean;
  isFeatured: boolean;
};

export type ProductActionState = {
  message: string;
  fieldErrors: Partial<Record<keyof ProductFormValues, string>>;
  values: ProductFormValues;
};

const emptyProductActionState: ProductActionState = {
  message: "",
  fieldErrors: {},
  values: {
    code: "",
    name: "",
    brand: "",
    categoryId: "",
    description: "",
    technicalSpecs: "",
    imageUrl: "",
    media: [{ type: "IMAGE", url: "", altText: "" }],
    unitLabel: "unidad",
    stockUnits: "0",
    unitPrice: "",
    wholesalePrice: "",
    wholesaleMinQty: "3",
    boxPrice: "",
    unitsPerBox: "",
    isVisible: true,
    isFeatured: false,
  },
};

export function getEmptyProductActionState(
  values?: Partial<ProductFormValues>,
): ProductActionState {
  return {
    message: "",
    fieldErrors: {},
    values: {
      ...emptyProductActionState.values,
      ...values,
    },
  };
}
