import { notFound } from "next/navigation";
import {
  updateProductFormAction,
} from "@/app/admin/actions";
import { getEmptyProductActionState } from "@/components/admin/product-form-state";
import { ProductForm } from "@/components/admin/product-form";
import { getCategoryOptions, getProductById } from "@/lib/store";

type ProductEditPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ProductEditPage({ params }: ProductEditPageProps) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProductById(id), getCategoryOptions()]);

  if (!product) {
    notFound();
  }

  return (
    <ProductForm
      action={updateProductFormAction}
      categories={categories}
      description="Actualiza precios, stock y visibilidad. El cambio impacta en el catálogo público al instante."
      initialState={getEmptyProductActionState({
        code: product.code,
        name: product.name,
        brand: product.brand ?? "",
        categoryId: product.categoryId ?? "",
        description: product.description ?? "",
        imageUrl: product.imageUrl ?? "",
        media: product.media.map((item) => ({
          type: item.type,
          url: item.url,
          altText: item.altText ?? "",
        })),
        unitLabel: product.unitLabel,
        stockUnits: String(product.stockUnits),
        unitPrice: String(product.unitPrice),
        wholesalePrice: product.wholesalePrice ? String(product.wholesalePrice) : "",
        wholesaleMinQty: String(product.wholesaleMinQty),
        boxPrice: product.boxPrice ? String(product.boxPrice) : "",
        unitsPerBox: product.unitsPerBox ? String(product.unitsPerBox) : "",
        isVisible: product.isVisible,
        isFeatured: product.isFeatured,
      })}
      product={product}
      title={`Editar ${product.name}`}
    />
  );
}
