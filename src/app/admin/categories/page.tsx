import Link from "next/link";
import { ExternalLink, FolderPlus, FolderTree, PackageSearch, Pencil, Plus, Search, X } from "lucide-react";
import { createCategoryAction, updateCategoryAction } from "@/app/admin/actions";
import { CategoryDeleteForm } from "@/components/admin/category-delete-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { getAdminCategories } from "@/lib/store";

type CategoriesPageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
export const dynamic = "force-dynamic";

const statusMessages: Record<string, string> = {
  created: "Categoría creada correctamente.", updated: "Categoría actualizada correctamente.", deleted: "Categoría eliminada correctamente.",
};

function categoryUrl(params: { q?: string; filter?: string; sort?: string; edit?: string; create?: boolean }) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.filter && params.filter !== "all") query.set("filter", params.filter);
  if (params.sort && params.sort !== "name") query.set("sort", params.sort);
  if (params.edit) query.set("edit", params.edit);
  if (params.create) query.set("create", "1");
  const suffix = query.toString();
  return `/admin/categories${suffix ? `?${suffix}` : ""}`;
}

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const categories = await getAdminCategories();
  const params = searchParams ? await searchParams : undefined;
  const status = typeof params?.status === "string" ? params.status : "";
  const error = typeof params?.error === "string" ? params.error : "";
  const query = typeof params?.q === "string" ? params.q.trim() : "";
  const filter = typeof params?.filter === "string" ? params.filter : "all";
  const sort = typeof params?.sort === "string" ? params.sort : "name";
  const editId = typeof params?.edit === "string" ? params.edit : "";
  const isCreating = params?.create === "1";
  const activeCategories = categories.filter((category) => category.productCount > 0).length;
  const emptyCategories = categories.length - activeCategories;
  const normalizedQuery = query.toLocaleLowerCase("es");

  const filteredCategories = categories.filter((category) => {
    const matchesQuery = !normalizedQuery || category.name.toLocaleLowerCase("es").includes(normalizedQuery) || category.slug.toLocaleLowerCase("es").includes(normalizedQuery);
    if (!matchesQuery) return false;
    if (filter === "active") return category.productCount > 0;
    if (filter === "empty") return category.productCount === 0;
    return true;
  }).sort((a, b) => {
    if (sort === "products-desc") return b.productCount - a.productCount || a.name.localeCompare(b.name, "es");
    if (sort === "products-asc") return a.productCount - b.productCount || a.name.localeCompare(b.name, "es");
    return a.name.localeCompare(b.name, "es");
  });

  const selectedCategory = editId ? categories.find((category) => category.id === editId) : undefined;
  const showEditor = isCreating || Boolean(selectedCategory);
  const persistentParams = { q: query, filter, sort };

  return (
    <section className="panel category-manager">
      <header className="category-manager-header">
        <div><p className="eyebrow">Estructura del catálogo</p><h1>Categorías</h1><p className="muted">Organiza los productos y controla cómo aparecen en la tienda.</p></div>
        <Link className="button button-primary" href={categoryUrl({ ...persistentParams, create: true })}><Plus size={17} /> Nueva categoría</Link>
      </header>

      {statusMessages[status] ? <div className="admin-toast admin-toast-success"><strong>Listo</strong><span>{statusMessages[status]}</span></div> : null}
      {error ? <div className="admin-toast admin-toast-error"><strong>No se pudo completar</strong><span>{error}</span></div> : null}

      <nav className="category-filter-tabs" aria-label="Filtrar categorías">
        {[
          { value: "all", label: "Todas", count: categories.length },
          { value: "active", label: "Con productos", count: activeCategories },
          { value: "empty", label: "Vacías", count: emptyCategories },
        ].map((item) => (
          <Link aria-current={filter === item.value ? "page" : undefined} className={filter === item.value ? "is-active" : ""} href={categoryUrl({ q: query, filter: item.value, sort })} key={item.value}>
            {item.label}<span>{item.count}</span>
          </Link>
        ))}
      </nav>

      <form className="category-manager-toolbar" method="get">
        <label className="category-manager-search"><Search size={18} aria-hidden="true" /><input defaultValue={query} name="q" placeholder="Buscar por nombre o URL…" type="search" /></label>
        <input name="filter" type="hidden" value={filter} />
        <label className="category-sort-field"><span>Ordenar</span><select defaultValue={sort} name="sort"><option value="name">Nombre A–Z</option><option value="products-desc">Más productos</option><option value="products-asc">Menos productos</option></select></label>
        <button className="button button-secondary" type="submit">Aplicar</button>
        {query || filter !== "all" || sort !== "name" ? <Link className="button button-ghost" href="/admin/categories">Limpiar</Link> : null}
      </form>

      <div className="category-manager-layout">
        <div className="category-table-card">
          <div className="category-table-head" aria-hidden="true"><span>Categoría</span><span>Productos</span><span>URL pública</span><span>Acciones</span></div>
          {filteredCategories.length ? <div className="category-table-body">
            {filteredCategories.map((category) => (
              <article className={selectedCategory?.id === category.id ? "category-table-row is-selected" : "category-table-row"} key={category.id}>
                <div className="category-table-name"><span className="category-table-icon"><FolderTree size={17} /></span><div><strong>{category.name}</strong><small>{category.productCount ? "Visible en el catálogo" : "Sin productos asignados"}</small></div></div>
                <Link className="category-product-count" href={`/admin/products?category=${encodeURIComponent(category.slug)}`}><strong>{category.productCount}</strong><span>producto{category.productCount === 1 ? "" : "s"}</span></Link>
                <a className="category-public-link" href={`/categoria/${encodeURIComponent(category.slug)}`} target="_blank" rel="noreferrer">/{category.slug}<ExternalLink size={13} /></a>
                <div className="category-row-actions">
                  <Link className="icon-button" href={categoryUrl({ ...persistentParams, edit: category.id })} title={`Editar ${category.name}`}><Pencil size={16} /><span className="sr-only">Editar {category.name}</span></Link>
                  <Link className="icon-button" href={`/admin/products?category=${encodeURIComponent(category.slug)}`} title="Ver productos"><PackageSearch size={16} /><span className="sr-only">Ver productos</span></Link>
                </div>
              </article>
            ))}
          </div> : <div className="category-manager-empty"><FolderTree size={28} /><strong>No encontramos categorías</strong><p>{categories.length ? "Prueba con otro término o limpia los filtros." : "Crea la primera categoría para organizar tu catálogo."}</p><Link className="button button-secondary" href="/admin/categories">Limpiar filtros</Link></div>}
        </div>

        {showEditor ? <aside className="category-editor-panel" aria-label={isCreating ? "Crear categoría" : "Editar categoría"}>
          <div className="category-editor-heading"><span className="category-editor-icon">{isCreating ? <FolderPlus size={19} /> : <Pencil size={18} />}</span><div><p>{isCreating ? "Nueva categoría" : "Editar categoría"}</p><h2>{isCreating ? "Crear categoría" : selectedCategory?.name}</h2></div><Link className="icon-button" href={categoryUrl(persistentParams)} title="Cerrar panel"><X size={17} /></Link></div>
          <form action={isCreating ? createCategoryAction : updateCategoryAction} className="category-editor-form">
            {!isCreating && selectedCategory ? <input name="categoryId" type="hidden" value={selectedCategory.id} /> : null}
            <label className="field"><span>Nombre comercial</span><input autoFocus defaultValue={selectedCategory?.name ?? ""} name="name" placeholder="Ej. Accesorios para celular" required /><small>La URL amigable se genera automáticamente desde el nombre.</small></label>
            {selectedCategory ? <div className="category-editor-preview"><span>URL pública</span><code>/categoria/{selectedCategory.slug}</code></div> : null}
            <SubmitButton pendingLabel={isCreating ? "Creando…" : "Guardando…"}>{isCreating ? "Crear categoría" : "Guardar cambios"}</SubmitButton>
          </form>
          {selectedCategory ? <div className="category-danger-zone"><div><strong>Eliminar categoría</strong><p>{selectedCategory.productCount ? "Puedes trasladar sus productos antes de eliminarla." : "Esta categoría no tiene productos asignados."}</p></div><CategoryDeleteForm categoryId={selectedCategory.id} categoryName={selectedCategory.name} productCount={selectedCategory.productCount} replacementOptions={categories.filter((category) => category.id !== selectedCategory.id)} /></div> : null}
        </aside> : null}
      </div>
    </section>
  );
}
