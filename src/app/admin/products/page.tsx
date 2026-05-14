import Link from "next/link";
import { PencilLine, Search, Trash2 } from "lucide-react";
import {
  bulkProductAction,
  deleteProductAction,
  toggleProductVisibilityAction,
} from "@/app/admin/actions";
import { getAdminProducts } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

type AdminProductsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const q = typeof params?.q === "string" ? params.q : "";
  const category = typeof params?.category === "string" ? params.category : "all";
  const brand = typeof params?.brand === "string" ? params.brand : "all";
  const visibility =
    typeof params?.visibility === "string" &&
    ["all", "visible", "hidden"].includes(params.visibility)
      ? (params.visibility as "all" | "visible" | "hidden")
      : "all";
  const photo =
    typeof params?.photo === "string" &&
    ["all", "missing", "with-photo"].includes(params.photo)
      ? (params.photo as "all" | "missing" | "with-photo")
      : "all";
  const stock =
    typeof params?.stock === "string" && ["all", "low"].includes(params.stock)
      ? (params.stock as "all" | "low")
      : "all";
  const page = Number(typeof params?.page === "string" ? params.page : "1");
  const data = await getAdminProducts({
    query: q,
    category,
    brand,
    visibility,
    photo,
    stock,
    page: Number.isNaN(page) ? 1 : page,
  });
  const status = typeof params?.status === "string" ? params.status : "";

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Productos</p>
          <h1>Listado optimizado para catálogo grande</h1>
        </div>
        <p className="panel-copy">
          Búsqueda rápida por código, nombre, marca o categoría. Diseñado para trabajar bien incluso con miles de SKU.
        </p>
      </div>

      <form className="filters-form admin-filters" method="GET">
        <label className="search-field">
          <Search size={18} />
          <input defaultValue={q} name="q" placeholder="Buscar producto..." />
        </label>
        <select defaultValue={category} name="category">
          <option value="all">Todas las categorías</option>
          {data.categories.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
        <select defaultValue={brand} name="brand">
          <option value="all">Todas las marcas</option>
          {data.brands.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        <select defaultValue={visibility} name="visibility">
          <option value="all">Todos los estados</option>
          <option value="visible">Solo visibles</option>
          <option value="hidden">Solo ocultos</option>
        </select>
        <select defaultValue={photo} name="photo">
          <option value="all">Todas las fotos</option>
          <option value="missing">Sin foto</option>
          <option value="with-photo">Con foto</option>
        </select>
        <select defaultValue={stock} name="stock">
          <option value="all">Todo el stock</option>
          <option value="low">Solo stock bajo</option>
        </select>
        <button className="button button-primary" type="submit">
          Buscar
        </button>
        <Link className="button button-secondary" href="/admin/categories">
          Categorías
        </Link>
        <Link className="button button-secondary" href="/admin/products/new">
          Nuevo producto
        </Link>
      </form>

      {status ? <p className="success-text">Operación completada: {status}</p> : null}
      <p className="results-copy">
        {data.totalResults} productos encontrados. Página {data.page} de {data.totalPages}.
      </p>

      {data.products.length ? (
        <>
        <form action={bulkProductAction} className="actions-row" id="bulk-products-form">
          <input name="bulkAction" type="hidden" value="hide" />
          <button className="button button-secondary" type="submit">
            Ocultar seleccionados
          </button>
          <button
            className="button button-ghost"
            name="bulkAction"
            type="submit"
            value="delete"
          >
            Eliminar seleccionados
          </button>
        </form>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th />
                <th>Producto</th>
                <th>Código</th>
                <th>Precios</th>
                <th>Stock</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.products.map((product) => (
              <tr key={product.id}>
                  <td data-label="Sel.">
                    <input form="bulk-products-form" name="productIds" type="checkbox" value={product.id} />
                  </td>
                  <td data-label="Producto">
                    <strong>{product.name}</strong>
                    <p className="muted">
                      {product.brand ?? "Sin marca"} · {product.category ?? "Sin categoría"}
                    </p>
                  </td>
                  <td data-label="Código">{product.code}</td>
                  <td data-label="Precios">
                    <strong>{formatCurrency(product.unitPrice)}</strong>
                    <p className="muted">
                      Mayor:{" "}
                      {product.wholesalePrice
                        ? formatCurrency(product.wholesalePrice)
                        : "igual"}
                      {product.boxPrice ? ` · Cajón: ${formatCurrency(product.boxPrice)}` : ""}
                    </p>
                  </td>
                  <td data-label="Stock">{product.stockUnits}</td>
                  <td data-label="Estado">
                    <span className={`status-badge ${product.isVisible ? "is-visible" : "is-hidden"}`}>
                      {product.isVisible ? "Visible" : "Oculto"}
                    </span>
                  </td>
                  <td data-label="Acciones">
                    <div className="table-actions">
                      <Link className="icon-button" href={`/admin/products/${product.id}`}>
                        <PencilLine size={16} />
                      </Link>
                      <form action={toggleProductVisibilityAction}>
                        <input name="productId" type="hidden" value={product.id} />
                        <input name="nextValue" type="hidden" value={String(!product.isVisible)} />
                        <button className="icon-button" type="submit">
                          {product.isVisible ? "Ocultar" : "Mostrar"}
                        </button>
                      </form>
                      <form action={deleteProductAction}>
                        <input name="productId" type="hidden" value={product.id} />
                        <button className="icon-button danger" type="submit">
                          <Trash2 size={16} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <article className="panel panel-slim empty-state">
          <p className="eyebrow">Sin coincidencias</p>
          <h2>No hay productos con ese filtro</h2>
          <p className="muted">Prueba con otra combinación de búsqueda, categoría o estado.</p>
        </article>
      )}

      <div className="pagination-row">
        {data.page > 1 ? (
          <Link
            className="button button-secondary"
            href={`/admin/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}&visibility=${encodeURIComponent(visibility)}&photo=${encodeURIComponent(photo)}&stock=${encodeURIComponent(stock)}&page=${data.page - 1}`}
          >
            Página anterior
          </Link>
        ) : (
          <span />
        )}

        {data.page < data.totalPages ? (
          <Link
            className="button button-secondary"
          href={`/admin/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}&visibility=${encodeURIComponent(visibility)}&photo=${encodeURIComponent(photo)}&stock=${encodeURIComponent(stock)}&page=${data.page + 1}`}
          >
            Siguiente página
          </Link>
        ) : null}
      </div>
    </section>
  );
}
