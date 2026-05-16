import { notFound } from "next/navigation";
import {
  updateProductFormAction,
} from "@/app/admin/actions";
import { getEmptyProductActionState } from "@/components/admin/product-form-state";
import { ProductForm } from "@/components/admin/product-form";
import { getCategoryOptions, getProductById } from "@/lib/store";

type ProductEditPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function ProductEditPage({ params, searchParams }: ProductEditPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const { id } = await params;
  const [product, categories] = await Promise.all([getProductById(id), getCategoryOptions()]);
  const status = typeof query?.status === "string" ? query.status : "";

  if (!product) {
    notFound();
  }

  return (
    <ProductForm
      action={updateProductFormAction}
      categories={categories}
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
      status={status}
      title={`Editar ${product.name}`}
    />
  );
}
