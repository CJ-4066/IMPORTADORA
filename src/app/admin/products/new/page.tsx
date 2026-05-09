import {
  createProductFormAction,
} from "@/app/admin/actions";
import { getEmptyProductActionState } from "@/components/admin/product-form-state";
import { ProductForm } from "@/components/admin/product-form";
import { getCategoryOptions } from "@/lib/store";

export default async function NewProductPage() {
  const categories = await getCategoryOptions();

  return (
    <ProductForm
      action={createProductFormAction}
      categories={categories}
      description="Completa los datos del SKU. Los precios unitarios y mayoristas quedan configurados desde aquí."
      initialState={getEmptyProductActionState()}
      title="Crear producto"
    />
  );
}
