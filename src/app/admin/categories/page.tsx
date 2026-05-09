import { Boxes, FolderTree, Search, Trash2 } from "lucide-react";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { getAdminCategories } from "@/lib/store";

type CategoriesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const categories = await getAdminCategories();
  const params = searchParams ? await searchParams : undefined;
  const status = typeof params?.status === "string" ? params.status : "";
  const error = typeof params?.error === "string" ? params.error : "";
  const query = typeof params?.q === "string" ? params.q.trim() : "";
  const normalizedQuery = query.toLowerCase();
  const filteredCategories = normalizedQuery
    ? categories.filter(
        (category) =>
          category.name.toLowerCase().includes(normalizedQuery) ||
          category.slug.toLowerCase().includes(normalizedQuery),
      )
    : categories;
  const activeCategories = categories.filter((category) => category.productCount > 0).length;
  const emptyCategories = categories.length - activeCategories;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Categorías</p>
          <h1>Organiza el catálogo por bloques reales</h1>
        </div>
      </div>

      <div className="category-admin-grid">
        <article className="category-create-card">
          <div className="stack-sm">
            <div className="category-icon">
              <FolderTree size={18} />
            </div>
            <h2>Nueva categoría</h2>
            <p className="muted">
              Añádela una vez y luego asígnala a los productos desde el formulario.
            </p>
          </div>

          <form action={createCategoryAction} className="stack-md">
            <label className="field">
              <span>Nombre</span>
              <input name="name" placeholder="Ej. Abarrotes" required />
            </label>
            <SubmitButton>Crear categoría</SubmitButton>
          </form>

          {status ? <p className="success-text">Operación completada: {status}</p> : null}
          {error ? <p className="error-text auth-error">{error}</p> : null}
        </article>

        <div className="category-list">
          <div className="category-toolbar-card">
            <div className="category-toolbar-copy">
              <h2>Vista compacta</h2>
              <p className="muted">
                Busca, corrige nombres y detecta categorías vacías sin recorrer una lista eterna.
              </p>
            </div>

            <form className="category-search-form" method="get">
              <label className="category-search-field">
                <Search size={17} />
                <input
                  defaultValue={query}
                  name="q"
                  placeholder="Buscar por nombre o slug"
                  type="search"
                />
              </label>
              {query ? (
                <a className="button button-ghost" href="/admin/categories">
                  Limpiar
                </a>
              ) : null}
            </form>
          </div>

          <div className="category-summary-grid">
            <article className="category-summary-card">
              <span className="category-summary-icon">
                <FolderTree size={17} />
              </span>
              <strong>{categories.length}</strong>
              <span>Total registradas</span>
            </article>
            <article className="category-summary-card">
              <span className="category-summary-icon">
                <Boxes size={17} />
              </span>
              <strong>{activeCategories}</strong>
              <span>Con productos</span>
            </article>
            <article className="category-summary-card">
              <span className="category-summary-icon">
                <Trash2 size={17} />
              </span>
              <strong>{emptyCategories}</strong>
              <span>Vacías</span>
            </article>
          </div>

          {filteredCategories.length ? (
            <div className="category-card-grid">
              {filteredCategories.map((category) => (
                <article className="category-card" key={category.id}>
                  <div className="category-card-top">
                    <div className="category-card-badge">
                      <FolderTree size={16} />
                    </div>
                    <div className="category-meta">
                      <span>{category.productCount} productos</span>
                      <code>/{category.slug}</code>
                    </div>
                  </div>

                  <form action={updateCategoryAction} className="category-card-form">
                    <input name="categoryId" type="hidden" value={category.id} />
                    <label className="field">
                      <span>Nombre de categoría</span>
                      <input defaultValue={category.name} name="name" required />
                    </label>
                    <div className="category-card-actions">
                      <SubmitButton pendingLabel="Guardando...">Guardar</SubmitButton>
                    </div>
                  </form>

                  <form action={deleteCategoryAction}>
                    <input name="categoryId" type="hidden" value={category.id} />
                    <button className="icon-button danger category-delete-button" type="submit">
                      <Trash2 size={16} />
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <article className="panel panel-slim">
              <p className="muted">
                {categories.length
                  ? "No hay categorías que coincidan con esa búsqueda."
                  : "Todavía no hay categorías creadas."}
              </p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
