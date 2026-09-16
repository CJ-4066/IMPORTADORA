"use client";

import { Trash2 } from "lucide-react";
import { deleteCategoryAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/submit-button";

type CategoryOption = { id: string; name: string };

type CategoryDeleteFormProps = {
  categoryId: string;
  categoryName: string;
  productCount: number;
  replacementOptions: CategoryOption[];
};

export function CategoryDeleteForm({ categoryId, categoryName, productCount, replacementOptions }: CategoryDeleteFormProps) {
  return (
    <form
      action={deleteCategoryAction}
      className="category-danger-form"
      onSubmit={(event) => {
        const message = productCount > 0
          ? `¿Eliminar “${categoryName}”? Se trasladarán ${productCount} productos según la opción seleccionada.`
          : `¿Eliminar “${categoryName}”? Esta acción no se puede deshacer.`;
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <input name="categoryId" type="hidden" value={categoryId} />
      {productCount > 0 ? (
        <label className="field">
          <span>Antes de eliminar, mover productos a</span>
          <select name="replacementCategoryId" defaultValue="">
            <option value="">Sin categoría</option>
            {replacementOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
      ) : null}
      <SubmitButton className="button-danger" pendingLabel="Eliminando…">
        <Trash2 size={16} /> Eliminar categoría
      </SubmitButton>
    </form>
  );
}
