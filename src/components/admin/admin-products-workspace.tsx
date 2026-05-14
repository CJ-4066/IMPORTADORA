"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Filter,
  ImageOff,
  ImagePlus,
  PencilLine,
  Square,
  SquareCheckBig,
} from "lucide-react";
import type { BrandOption, CatalogProduct, CategoryOption } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

type AdminProductsWorkspaceProps = {
  products: CatalogProduct[];
  categories: CategoryOption[];
  brands: BrandOption[];
  status: string;
  page: number;
  totalPages: number;
  totalResults: number;
  stats: {
    totalProducts: number;
    withPhotoProducts: number;
    withoutPhotoProducts: number;
    visibleProducts: number;
    hiddenProducts: number;
  };
  filters: {
    q: string;
    category: string;
    brand: string;
    visibility: "all" | "visible" | "hidden";
    photo: "all" | "missing" | "with-photo";
    stock: "all" | "low";
  };
};

type BulkAction = "hide" | "show" | "feature" | "unfeature" | "hide-without-photo";

type ToastState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

function buildQuery(filters: AdminProductsWorkspaceProps["filters"], extra: Partial<Record<string, string>> = {}) {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.category !== "all") {
    params.set("category", filters.category);
  }

  if (filters.brand !== "all") {
    params.set("brand", filters.brand);
  }

  if (filters.visibility !== "all") {
    params.set("visibility", filters.visibility);
  }

  if (filters.photo !== "all") {
    params.set("photo", filters.photo);
  }

  if (filters.stock !== "all") {
    params.set("stock", filters.stock);
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }

  return params.toString();
}

async function postBulkAction(action: BulkAction, productIds: string[]) {
  const response = await fetch("/api/admin/products/bulk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, productIds }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    updatedCount?: number;
    hiddenWithoutPhotoCount?: number;
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo completar la acción.");
  }

  return payload;
}

export function AdminProductsWorkspace({
  products,
  categories,
  brands,
  status,
  page,
  totalPages,
  totalResults,
  stats,
  filters,
}: AdminProductsWorkspaceProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const [toast, setToast] = useState<ToastState>(
    status ? { tone: "success", message: `Operación completada: ${status}` } : null,
  );

  const selectedCount = selectedIds.length;
  const allSelected = products.length > 0 && selectedCount === products.length;

  const selectedLabel = useMemo(() => {
    if (!selectedCount) {
      return "No hay productos seleccionados.";
    }

    return `${selectedCount} productos seleccionados.`;
  }, [selectedCount]);

  const currentHref = useMemo(() => `/admin/products?${buildQuery(filters)}`, [filters]);

  function toggleSelection(productId: string) {
    setSelectedIds((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId],
    );
  }

  function setAllSelected(nextValue: boolean) {
    setSelectedIds(nextValue ? products.map((product) => product.id) : []);
  }

  async function runBulkAction(action: BulkAction, productIds: string[]) {
    if (!productIds.length && action !== "hide-without-photo") {
      setToast({ tone: "error", message: "Selecciona al menos un producto." });
      return;
    }

    const confirmMessage = {
      hide: `Ocultar ${productIds.length} productos seleccionados?`,
      show: `Mostrar ${productIds.length} productos seleccionados?`,
      feature: `Marcar ${productIds.length} productos seleccionados como destacados?`,
      unfeature: `Quitar destacado a ${productIds.length} productos seleccionados?`,
      "hide-without-photo": "Ocultar todos los productos sin foto?",
    }[action];

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setPendingAction(action);

    try {
      const payload = await postBulkAction(action, productIds);
      const totalUpdated =
        action === "hide-without-photo"
          ? payload.hiddenWithoutPhotoCount ?? payload.updatedCount ?? 0
          : payload.updatedCount ?? 0;

      setSelectedIds([]);
      setToast({
        tone: "success",
        message:
          action === "hide-without-photo"
            ? `${totalUpdated} productos sin foto fueron ocultados.`
            : `${totalUpdated} productos actualizados correctamente.`,
      });
      router.refresh();
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo completar la acción.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function runSingleAction(action: Exclude<BulkAction, "hide-without-photo">, productId: string) {
    await runBulkAction(action, [productId]);
  }

  return (
    <section className="panel admin-products-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Productos</p>
          <h1>Listado optimizado para catálogo grande</h1>
        </div>
        <p className="panel-copy">
          Búsqueda rápida por código, nombre, marca o categoría. Diseñado para trabajar bien incluso con miles de SKU.
        </p>
      </div>

      {toast ? (
        <div className={`admin-toast admin-toast-${toast.tone}`}>
          <strong>{toast.tone === "success" ? "Listo" : toast.tone === "error" ? "Error" : "Aviso"}</strong>
          <span>{toast.message}</span>
          <button
            className="icon-button"
            onClick={() => setToast(null)}
            type="button"
          >
            <SquareCheckBig size={16} />
          </button>
        </div>
      ) : null}

      <div className="admin-products-summary-grid">
        <Link className="metric-panel metric-panel-link" href={currentHref}>
          <Square size={22} />
          <strong>{stats.totalProducts}</strong>
          <span>Total productos</span>
        </Link>
        <Link className="metric-panel metric-panel-link" href={`/admin/products?${buildQuery(filters, { photo: "with-photo" })}`}>
          <ImagePlus size={22} />
          <strong>{stats.withPhotoProducts}</strong>
          <span>Con foto</span>
        </Link>
        <Link className="metric-panel metric-panel-link" href={`/admin/products?${buildQuery(filters, { photo: "missing" })}`}>
          <ImageOff size={22} />
          <strong>{stats.withoutPhotoProducts}</strong>
          <span>Sin foto</span>
        </Link>
        <Link className="metric-panel metric-panel-link" href={`/admin/products?${buildQuery(filters, { visibility: "visible" })}`}>
          <Eye size={22} />
          <strong>{stats.visibleProducts}</strong>
          <span>Visibles</span>
        </Link>
        <Link className="metric-panel metric-panel-link" href={`/admin/products?${buildQuery(filters, { visibility: "hidden" })}`}>
          <EyeOff size={22} />
          <strong>{stats.hiddenProducts}</strong>
          <span>Ocultos</span>
        </Link>
      </div>

      <div className="admin-products-toolbar">
        <div className="admin-products-chip-row">
          <Link className={`admin-chip${filters.photo === "all" && filters.visibility === "all" ? " is-active" : ""}`} href={`/admin/products?${buildQuery(filters, { photo: "", visibility: "" })}`}>
            Todos
          </Link>
          <Link className={`admin-chip${filters.photo === "with-photo" ? " is-active" : ""}`} href={`/admin/products?${buildQuery(filters, { photo: "with-photo" })}`}>
            Con foto
          </Link>
          <Link className={`admin-chip${filters.photo === "missing" ? " is-active" : ""}`} href={`/admin/products?${buildQuery(filters, { photo: "missing" })}`}>
            Sin foto
          </Link>
          <Link className={`admin-chip${filters.visibility === "visible" ? " is-active" : ""}`} href={`/admin/products?${buildQuery(filters, { visibility: "visible" })}`}>
            Visibles
          </Link>
          <Link className={`admin-chip${filters.visibility === "hidden" ? " is-active" : ""}`} href={`/admin/products?${buildQuery(filters, { visibility: "hidden" })}`}>
            Ocultos
          </Link>
        </div>

        <form className="filters-form admin-filters" method="GET">
          <label className="search-field">
            <Filter size={18} />
            <input defaultValue={filters.q} name="q" placeholder="Buscar producto..." />
          </label>
          <select defaultValue={filters.category} name="category">
            <option value="all">Todas las categorías</option>
            {categories.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
          <select defaultValue={filters.brand} name="brand">
            <option value="all">Todas las marcas</option>
            {brands.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <select defaultValue={filters.visibility} name="visibility">
            <option value="all">Todos los estados</option>
            <option value="visible">Solo visibles</option>
            <option value="hidden">Solo ocultos</option>
          </select>
          <select defaultValue={filters.photo} name="photo">
            <option value="all">Todas las fotos</option>
            <option value="missing">Sin foto</option>
            <option value="with-photo">Con foto</option>
          </select>
          <select defaultValue={filters.stock} name="stock">
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

        <div className="admin-products-bulk-row">
          <span className="muted">{selectedLabel}</span>
          <div className="actions-row admin-products-bulk-actions">
            <button
              className="button button-secondary"
              disabled={pendingAction !== null || selectedCount === 0}
              onClick={() => void runBulkAction("hide", selectedIds)}
              type="button"
            >
              Ocultar seleccionados
            </button>
            <button
              className="button button-secondary"
              disabled={pendingAction !== null || selectedCount === 0}
              onClick={() => void runBulkAction("show", selectedIds)}
              type="button"
            >
              Mostrar seleccionados
            </button>
            <button
              className="button button-secondary"
              disabled={pendingAction !== null || selectedCount === 0}
              onClick={() => void runBulkAction("feature", selectedIds)}
              type="button"
            >
              Marcar destacados
            </button>
            <button
              className="button button-secondary"
              disabled={pendingAction !== null || selectedCount === 0}
              onClick={() => void runBulkAction("unfeature", selectedIds)}
              type="button"
            >
              Quitar destacados
            </button>
            <button
              className="button button-primary"
              disabled={pendingAction !== null}
              onClick={() => void runBulkAction("hide-without-photo", [])}
              type="button"
            >
              Ocultar todos sin foto
            </button>
          </div>
        </div>
      </div>

      <p className="results-copy">
        {totalResults} productos encontrados. Página {page} de {totalPages}.
      </p>

      {products.length ? (
        <div className="table-wrap">
          <table className="data-table admin-products-table">
            <thead>
              <tr>
                <th>
                  <label className="check admin-select-all">
                    <input
                      checked={allSelected}
                      onChange={(event) => setAllSelected(event.target.checked)}
                      type="checkbox"
                    />
                    <span />
                  </label>
                </th>
                <th>Producto</th>
                <th>Foto</th>
                <th>Código</th>
                <th>Precios</th>
                <th>Stock</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const hasPhoto = product.hasPhoto;

                return (
                  <tr key={product.id}>
                    <td data-label="Sel.">
                      <input
                        checked={selectedIds.includes(product.id)}
                        form={undefined}
                        onChange={() => toggleSelection(product.id)}
                        type="checkbox"
                      />
                    </td>
                    <td data-label="Producto">
                      <strong>{product.name}</strong>
                      <p className="muted">{product.brand ?? "Sin marca"}</p>
                    </td>
                    <td data-label="Foto">
                      {hasPhoto ? (
                        <span className="status-badge is-visible">Con foto</span>
                      ) : (
                        <span className="status-badge is-hidden">Sin foto</span>
                      )}
                    </td>
                    <td data-label="Código">{product.code}</td>
                    <td data-label="Precios">
                      <strong>{formatCurrency(product.unitPrice)}</strong>
                      <p className="muted">
                        Mayor: {product.wholesalePrice ? formatCurrency(product.wholesalePrice) : "igual"}
                      </p>
                    </td>
                    <td data-label="Stock">{product.stockUnits}</td>
                    <td data-label="Estado">
                      <span className={`status-badge ${product.isVisible ? "is-visible" : "is-hidden"}`}>
                        {product.isVisible ? "Visible" : "Oculto"}
                      </span>
                      {product.isFeatured ? (
                        <span className="status-badge is-visible">Destacado</span>
                      ) : null}
                    </td>
                    <td data-label="Acciones">
                      <div className="table-actions admin-product-actions">
                        {!hasPhoto ? (
                          <span className="status-badge is-hidden">Sin foto</span>
                        ) : null}
                        {!hasPhoto ? (
                          <button
                            className="button button-secondary button-chip"
                            disabled={pendingAction !== null}
                            onClick={() => void runSingleAction("hide", product.id)}
                            type="button"
                          >
                            Ocultar
                          </button>
                        ) : null}
                        {!hasPhoto ? (
                          <Link className="button button-secondary button-chip" href={`/admin/products/${product.id}#media`}>
                            Agregar foto
                          </Link>
                        ) : null}
                        <Link className="icon-button" href={`/admin/products/${product.id}`}>
                          <PencilLine size={16} />
                        </Link>
                        <button
                          className="button button-secondary button-chip"
                          disabled={pendingAction !== null}
                          onClick={() => void runSingleAction(product.isVisible ? "hide" : "show", product.id)}
                          type="button"
                        >
                          {product.isVisible ? "Ocultar" : "Mostrar"}
                        </button>
                        <button
                          className="button button-secondary button-chip"
                          disabled={pendingAction !== null}
                          onClick={() => void runSingleAction(product.isFeatured ? "unfeature" : "feature", product.id)}
                          type="button"
                        >
                          {product.isFeatured ? "Quitar destacado" : "Destacar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <article className="panel panel-slim empty-state">
          <p className="eyebrow">Sin coincidencias</p>
          <h2>No hay productos con ese filtro</h2>
          <p className="muted">Prueba con otra combinación de búsqueda, categoría o estado.</p>
        </article>
      )}

      <div className="pagination-row">
        {page > 1 ? (
          <Link className="button button-secondary" href={`/admin/products?${buildQuery(filters, { page: String(page - 1) })}`}>
            Página anterior
          </Link>
        ) : (
          <span />
        )}

        {page < totalPages ? (
          <Link className="button button-secondary" href={`/admin/products?${buildQuery(filters, { page: String(page + 1) })}`}>
            Siguiente página
          </Link>
        ) : null}
      </div>
    </section>
  );
}
