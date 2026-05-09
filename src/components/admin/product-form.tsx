"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils";
import type { CatalogProduct, CategoryOption } from "@/lib/store";
import type { ProductActionState } from "@/components/admin/product-form-state";
import { ProductMediaManager } from "@/components/admin/product-media-manager";
import { SubmitButton } from "@/components/ui/submit-button";

type ProductFormProps = {
  title: string;
  description: string;
  action: (
    state: ProductActionState,
    formData: FormData,
  ) => ProductActionState | Promise<ProductActionState>;
  categories: CategoryOption[];
  initialState: ProductActionState;
  product?: CatalogProduct;
};

export function ProductForm({
  title,
  description,
  action,
  categories,
  initialState,
  product,
}: ProductFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const values = state.values;
  const fieldErrors = state.fieldErrors;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>{title}</h1>
        </div>
        <p className="panel-copy">{description}</p>
      </div>

      <form action={formAction} className="stack-lg">
        {product ? <input type="hidden" name="productId" value={product.id} /> : null}
        {state.message ? <p className="error-text auth-error">{state.message}</p> : null}

        <div className="form-grid">
          <label className={cn("field", fieldErrors.code && "field-has-error")}>
            <span>Código</span>
            <input aria-invalid={Boolean(fieldErrors.code)} defaultValue={values.code} name="code" required />
            {fieldErrors.code ? <small className="field-error">{fieldErrors.code}</small> : null}
          </label>

          <label className={cn("field", fieldErrors.name && "field-has-error")}>
            <span>Nombre</span>
            <input aria-invalid={Boolean(fieldErrors.name)} defaultValue={values.name} name="name" required />
            {fieldErrors.name ? <small className="field-error">{fieldErrors.name}</small> : null}
          </label>

          <label className={cn("field", fieldErrors.brand && "field-has-error")}>
            <span>Marca</span>
            <input aria-invalid={Boolean(fieldErrors.brand)} defaultValue={values.brand} name="brand" />
            {fieldErrors.brand ? <small className="field-error">{fieldErrors.brand}</small> : null}
          </label>

          <label className={cn("field", fieldErrors.categoryId && "field-has-error")}>
            <span>Categoría</span>
            <select
              aria-invalid={Boolean(fieldErrors.categoryId)}
              defaultValue={values.categoryId}
              name="categoryId"
            >
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {fieldErrors.categoryId ? (
              <small className="field-error">{fieldErrors.categoryId}</small>
            ) : null}
          </label>

          <label className={cn("field field-wide", fieldErrors.description && "field-has-error")}>
            <span>Descripción</span>
            <textarea
              aria-invalid={Boolean(fieldErrors.description)}
              defaultValue={values.description}
              name="description"
              rows={4}
            />
            {fieldErrors.description ? (
              <small className="field-error">{fieldErrors.description}</small>
            ) : null}
          </label>

          <label className={cn("field field-wide", fieldErrors.imageUrl && "field-has-error")}>
            <span>URL de portada</span>
            <input
              aria-invalid={Boolean(fieldErrors.imageUrl)}
              defaultValue={values.imageUrl}
              name="imageUrl"
              type="url"
            />
            {fieldErrors.imageUrl ? <small className="field-error">{fieldErrors.imageUrl}</small> : null}
          </label>

          <label className={cn("field", fieldErrors.unitLabel && "field-has-error")}>
            <span>Unidad</span>
            <input
              aria-invalid={Boolean(fieldErrors.unitLabel)}
              defaultValue={values.unitLabel}
              name="unitLabel"
              required
            />
            {fieldErrors.unitLabel ? <small className="field-error">{fieldErrors.unitLabel}</small> : null}
          </label>

          <label className={cn("field", fieldErrors.stockUnits && "field-has-error")}>
            <span>Stock en unidades</span>
            <input
              aria-invalid={Boolean(fieldErrors.stockUnits)}
              defaultValue={values.stockUnits}
              min={0}
              name="stockUnits"
              required
              type="number"
            />
            {fieldErrors.stockUnits ? <small className="field-error">{fieldErrors.stockUnits}</small> : null}
          </label>

          <label className={cn("field", fieldErrors.unitPrice && "field-has-error")}>
            <span>Precio unitario</span>
            <input
              aria-invalid={Boolean(fieldErrors.unitPrice)}
              defaultValue={values.unitPrice}
              min="0.01"
              name="unitPrice"
              required
              step="0.01"
              type="number"
            />
            {fieldErrors.unitPrice ? <small className="field-error">{fieldErrors.unitPrice}</small> : null}
          </label>

          <label className={cn("field", fieldErrors.wholesalePrice && "field-has-error")}>
            <span>Precio mayorista</span>
            <input
              aria-invalid={Boolean(fieldErrors.wholesalePrice)}
              defaultValue={values.wholesalePrice}
              min="0.01"
              name="wholesalePrice"
              step="0.01"
              type="number"
            />
            {fieldErrors.wholesalePrice ? (
              <small className="field-error">{fieldErrors.wholesalePrice}</small>
            ) : null}
          </label>

          <label className={cn("field", fieldErrors.wholesaleMinQty && "field-has-error")}>
            <span>Mínimo mayorista</span>
            <input
              aria-invalid={Boolean(fieldErrors.wholesaleMinQty)}
              defaultValue={values.wholesaleMinQty}
              min={2}
              name="wholesaleMinQty"
              required
              type="number"
            />
            {fieldErrors.wholesaleMinQty ? (
              <small className="field-error">{fieldErrors.wholesaleMinQty}</small>
            ) : null}
          </label>

          <label className={cn("field", fieldErrors.boxPrice && "field-has-error")}>
            <span>Precio por cajón</span>
            <input
              aria-invalid={Boolean(fieldErrors.boxPrice)}
              defaultValue={values.boxPrice}
              min="0.01"
              name="boxPrice"
              step="0.01"
              type="number"
            />
            {fieldErrors.boxPrice ? <small className="field-error">{fieldErrors.boxPrice}</small> : null}
          </label>

          <label className={cn("field", fieldErrors.unitsPerBox && "field-has-error")}>
            <span>Unidades por cajón</span>
            <input
              aria-invalid={Boolean(fieldErrors.unitsPerBox)}
              defaultValue={values.unitsPerBox}
              min={1}
              name="unitsPerBox"
              type="number"
            />
            {fieldErrors.unitsPerBox ? <small className="field-error">{fieldErrors.unitsPerBox}</small> : null}
          </label>
        </div>

        <ProductMediaManager error={fieldErrors.media} initialItems={values.media} />

        <div className="checkbox-row">
          <label className="check">
            <input defaultChecked={values.isVisible} name="isVisible" type="checkbox" />
            <span>Visible en el catálogo</span>
          </label>

          <label className="check">
            <input defaultChecked={values.isFeatured} name="isFeatured" type="checkbox" />
            <span>Destacado</span>
          </label>
        </div>

        <div className="actions-row">
          <SubmitButton>{product ? "Guardar cambios" : "Crear producto"}</SubmitButton>
        </div>
      </form>
    </section>
  );
}
