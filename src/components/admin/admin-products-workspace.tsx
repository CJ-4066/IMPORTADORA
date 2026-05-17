"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Filter,
  ImageOff,
  ImagePlus,
  PencilLine,
  MoreHorizontal,
  Square,
  SquareCheckBig,
  TriangleAlert,
  Trash2,
} from "lucide-react";
import { deleteProductAction } from "@/app/admin/actions";
import type { AdminProductListItem, BrandOption, CategoryOption } from "@/lib/store";
import { CHANGE_CODES } from "@/lib/change-codes";
import { formatCurrency } from "@/lib/utils";

type AdminProductsWorkspaceProps = {
  products: AdminProductListItem[];
  categories: CategoryOption[];
  brands: BrandOption[];
  status: string;
  page: number;
  pageSize: number;
  totalPages: number;
  totalResults: number;
  stats: {
    totalProducts: number;
    withPhotoProducts: number;
    withoutPhotoProducts: number;
    visibleProducts: number;
    hiddenProducts: number;
    needsReviewProducts: number;
  };
  filters: {
    q: string;
    category: string;
    brand: string;
    visibility: "all" | "visible" | "hidden";
    photo: "all" | "missing" | "with-photo";
    stock: "all" | "low";
    issue: "all" | "review";
  };
};

type BulkAction = "hide" | "show" | "feature" | "unfeature" | "hide-without-photo";

type ToastState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

const statusMessages: Record<string, { tone: "success" | "error" | "info"; message: string }> = {
  created: { tone: "success", message: "Producto creado correctamente." },
  updated: { tone: "success", message: "Cambios guardados correctamente." },
  deleted: { tone: "success", message: "Producto eliminado correctamente." },
  "bulk-hidden": { tone: "success", message: "Los productos seleccionados fueron ocultados." },
  "bulk-deleted": { tone: "success", message: "Los productos seleccionados fueron eliminados." },
  "photo-hidden": { tone: "success", message: "Se ocultaron los productos sin foto." },
  "no-selection": { tone: "info", message: "Selecciona al menos un producto." },
  "invalid-action": { tone: "error", message: "La acción solicitada no es válida." },
};

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

  if (filters.issue !== "all") {
    params.set("issue", filters.issue);
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
  pageSize,
  stats,
  filters,
}: AdminProductsWorkspaceProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const [openMenuProductId, setOpenMenuProductId] = useState<string | null>(null);
  const [openMenuPosition, setOpenMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ productId: string; productName: string } | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const deleteFormRef = useRef<HTMLFormElement | null>(null);
  const [toast, setToast] = useState<ToastState>(status ? statusMessages[status] ?? {
    tone: "success",
    message: "Operación completada correctamente.",
  } : null);

  const selectedCount = selectedIds.length;
  const allSelected = products.length > 0 && selectedCount === products.length;
  const pageStart = totalResults > 0 ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, totalResults);

  const currentHref = useMemo(() => `/admin/products?${buildQuery(filters)}`, [filters]);
  const hasAnyFilter =
    Boolean(filters.q) ||
    filters.category !== "all" ||
    filters.brand !== "all" ||
    filters.visibility !== "all" ||
    filters.photo !== "all" ||
    filters.stock !== "all" ||
    filters.issue !== "all";

  function toggleSelection(productId: string) {
    setSelectedIds((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId],
    );
  }

  function setAllSelected(nextValue: boolean) {
    setSelectedIds(nextValue ? products.map((product) => product.id) : []);
  }

  function closeMenu() {
    setOpenMenuProductId(null);
    setOpenMenuPosition(null);
  }

  function closeDeleteTarget() {
    setDeleteTarget(null);
  }

  function openMenu(productId: string) {
    const button = menuButtonRefs.current[productId];

    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const estimatedWidth = 18 * 16;
    const estimatedHeight = 220;
    const shouldOpenAbove = rect.bottom + estimatedHeight + 16 > window.innerHeight;
    const top = shouldOpenAbove ? Math.max(12, rect.top - estimatedHeight - 12) : rect.bottom + 12;
    const left = Math.min(
      Math.max(12, rect.right - estimatedWidth),
      window.innerWidth - estimatedWidth - 12,
    );

    setOpenMenuProductId(productId);
    setOpenMenuPosition({ top, left });
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
      closeMenu();
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

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      const popover = document.querySelector(".admin-product-more-popover");
      if (popover && !popover.contains(target)) {
        closeMenu();
      }

      const deleteDialog = document.querySelector(".admin-confirm-dialog");
      if (deleteDialog && !deleteDialog.contains(target)) {
        closeDeleteTarget();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    function handleViewportChange() {
      closeMenu();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, []);

  const activeProduct = openMenuProductId
    ? products.find((product) => product.id === openMenuProductId) ?? null
    : null;

  return (
    <section className="panel admin-products-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Productos</p>
          <h1>Listado optimizado para catálogo grande</h1>
        </div>
      </div>

      {toast ? (
        <div className={`admin-toast admin-toast-${toast.tone}`}>
          <strong>{toast.tone === "success" ? "Listo" : toast.tone === "error" ? "Error" : "Aviso"}</strong>
          <span>{toast.message}</span>
          <button
            className="icon-button admin-toast-close"
            onClick={() => setToast(null)}
            type="button"
          >
            <SquareCheckBig size={16} />
          </button>
        </div>
      ) : null}

      <div className="admin-products-summary-grid">
        <Link
          className="metric-panel metric-panel-link"
          href={currentHref}
          data-change-code={CHANGE_CODES.ADMIN_STABLE_PAGINATION}
        >
          <Square size={22} />
          <strong>{stats.totalProducts}</strong>
          <span>Total productos</span>
        </Link>
        <Link
          className="metric-panel metric-panel-link"
          href={`/admin/products?${buildQuery(filters, { photo: "with-photo" })}`}
          data-change-code={CHANGE_CODES.ADMIN_VISIBLE_WITH_PHOTO}
        >
          <ImagePlus size={22} />
          <strong>{stats.withPhotoProducts}</strong>
          <span>Con foto</span>
        </Link>
        <Link
          className="metric-panel metric-panel-link"
          href={`/admin/products?${buildQuery(filters, { photo: "missing" })}`}
          data-change-code={CHANGE_CODES.ADMIN_REVIEW_ALERTS}
        >
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
        <Link
          className="metric-panel metric-panel-link"
          href={`/admin/products?${buildQuery(filters, { issue: "review" })}`}
          data-change-code={CHANGE_CODES.ADMIN_REVIEW_ALERTS}
        >
          <TriangleAlert size={22} />
          <strong>{stats.needsReviewProducts}</strong>
          <span>Productos a revisar</span>
        </Link>
      </div>

      <div className="admin-products-toolbar">
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
          <input name="issue" type="hidden" value={filters.issue} />
          <button className="button button-primary" type="submit">
            Buscar
          </button>
          {hasAnyFilter ? (
            <Link className="button button-secondary" href="/admin/products">
              Limpiar
            </Link>
          ) : null}
        </form>

        <div className="admin-products-utility-row">
          <div className="admin-products-utility-links">
            <Link className="button button-secondary" href="/admin/categories">
              Categorías
            </Link>
            <Link className="button button-secondary" href="/admin/products/new">
              Nuevo producto
            </Link>
          </div>

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

      {selectedCount > 0 ? (
        <div className="admin-products-selection-bar">
          <strong>{selectedCount} seleccionados</strong>
          <div className="actions-row admin-products-bulk-actions">
            <button
              className="button button-secondary"
              disabled={pendingAction !== null}
              onClick={() => void runBulkAction("hide", selectedIds)}
              type="button"
            >
              Ocultar
            </button>
            <button
              className="button button-secondary"
              disabled={pendingAction !== null}
              onClick={() => void runBulkAction("show", selectedIds)}
              type="button"
            >
              Mostrar
            </button>
            <button
              className="button button-secondary"
              disabled={pendingAction !== null}
              onClick={() => void runBulkAction("feature", selectedIds)}
              type="button"
            >
              Destacar
            </button>
            <button
              className="button button-secondary"
              disabled={pendingAction !== null}
              onClick={() => void runBulkAction("unfeature", selectedIds)}
              type="button"
            >
              Quitar destacado
            </button>
          </div>
        </div>
      ) : null}

      <p className="results-copy">
        Mostrando {pageStart}–{pageEnd} de {totalResults} · página {page} de {totalPages}.
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
                const hasStock = product.stockUnits > 0;
                const isEffectivelyVisible = product.isVisible && hasPhoto && hasStock;
                const needsReview = !hasPhoto || !hasStock;

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
                      <div className="admin-product-photo-cell">
                        {product.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={product.name}
                            className="admin-product-thumb"
                            height={40}
                            decoding="async"
                            loading="lazy"
                            src={product.thumbnailUrl}
                            width={40}
                          />
                        ) : (
                          <span className="admin-product-thumb admin-product-thumb-empty">
                            <ImageOff size={16} />
                          </span>
                        )}
                        {hasPhoto ? (
                          <span className="status-badge is-visible">Con foto</span>
                        ) : (
                          <span className="status-badge is-hidden">Sin foto</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Código">{product.code}</td>
                    <td data-label="Precios">
                      <strong>{formatCurrency(product.unitPrice)}</strong>
                      {product.wholesalePrice ? (
                        <p className="muted">Mayor: {formatCurrency(product.wholesalePrice)}</p>
                      ) : null}
                    </td>
                    <td data-label="Stock">{product.stockUnits}</td>
                    <td data-label="Estado">
                      <span className={`status-badge ${isEffectivelyVisible ? "is-visible" : "is-hidden"}`}>
                        {isEffectivelyVisible ? "Visible" : "Oculto"}
                      </span>
                      {needsReview ? (
                        <span className="status-badge is-warning">
                          {!hasPhoto && !hasStock ? "Sin foto y sin stock" : !hasPhoto ? "Sin foto" : "Sin stock"}
                        </span>
                      ) : null}
                      {product.isFeatured ? (
                        <span className="status-badge is-visible">Destacado</span>
                      ) : null}
                    </td>
                    <td data-label="Acciones">
                      <div className="table-actions admin-product-actions">
                        <Link className="icon-button" href={`/admin/products/${product.id}`}>
                          <PencilLine size={16} />
                        </Link>
                        {!hasPhoto || !hasStock ? (
                          <Link className="button button-secondary button-chip" href={`/admin/products/${product.id}#media`}>
                            Agregar foto
                          </Link>
                        ) : null}
                        <button
                          ref={(node) => {
                            menuButtonRefs.current[product.id] = node;
                          }}
                          className="icon-button"
                          aria-label={`Más acciones para ${product.name}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuProductId === product.id}
                          onClick={() => {
                            if (openMenuProductId === product.id) {
                              closeMenu();
                              return;
                            }

                            openMenu(product.id);
                          }}
                          type="button"
                        >
                          <MoreHorizontal size={16} />
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

      {openMenuProductId && openMenuPosition && activeProduct && typeof document !== "undefined"
        ? createPortal(
            <div
              className="admin-product-more-popover"
              style={{
                left: `${openMenuPosition.left}px`,
                top: `${openMenuPosition.top}px`,
              }}
            >
              <div className="admin-product-more-menu">
                {!activeProduct.hasPhoto ? (
                  <button
                    className="button button-secondary button-chip"
                    disabled={pendingAction !== null}
                    onClick={() => void runSingleAction("hide", activeProduct.id)}
                    type="button"
                  >
                    Ocultar
                  </button>
                ) : null}
                <button
                  className="button button-secondary button-chip"
                  disabled={pendingAction !== null}
                  onClick={() => {
                    void runSingleAction(activeProduct.isVisible && activeProduct.hasPhoto ? "hide" : "show", activeProduct.id);
                  }}
                  type="button"
                >
                  {activeProduct.isVisible && activeProduct.hasPhoto && activeProduct.stockUnits > 0
                    ? "Ocultar"
                    : "Mostrar"}
                </button>
                <button
                  className="button button-secondary button-chip"
                  disabled={pendingAction !== null}
                  onClick={() => void runSingleAction(activeProduct.isFeatured ? "unfeature" : "feature", activeProduct.id)}
                  type="button"
                >
                  {activeProduct.isFeatured ? "Quitar destacado" : "Destacar"}
                </button>
                <button
                  className="button button-secondary button-chip danger"
                  disabled={pendingAction !== null}
                  onClick={() => {
                    closeMenu();
                    setDeleteTarget({ productId: activeProduct.id, productName: activeProduct.name });
                  }}
                  type="button"
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}

      {deleteTarget
        ? createPortal(
            <div className="admin-confirm-backdrop" role="presentation" onClick={closeDeleteTarget}>
              <div
                aria-modal="true"
                className="admin-confirm-dialog"
                role="dialog"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="eyebrow">Confirmación</p>
                <h2>Eliminar producto</h2>
                <p>Eliminarás {deleteTarget.productName}. Esta acción no se puede deshacer.</p>
                <form action={deleteProductAction} ref={deleteFormRef}>
                  <input name="productId" type="hidden" value={deleteTarget.productId} />
                  <div className="admin-confirm-actions">
                    <button className="button button-secondary" onClick={closeDeleteTarget} type="button">
                      Cancelar
                    </button>
                    <button
                      className="button button-primary"
                      disabled={pendingAction !== null}
                      onClick={() => {
                        setPendingAction("hide");
                        deleteFormRef.current?.requestSubmit();
                      }}
                      type="button"
                    >
                      Eliminar
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
