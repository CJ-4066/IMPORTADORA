"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Filter,
  ImageOff,
  PackageX,
  PencilLine,
  MoreHorizontal,
  SquareCheckBig,
  TriangleAlert,
  RefreshCw,
  Sparkles,
  Truck,
  Trash2,
  Warehouse,
} from "lucide-react";
import { deleteProductAction } from "@/app/admin/actions";
import type {
  AdminProductCatalogStats,
  AdminProductListItem,
  BrandOption,
  CategoryOption,
} from "@/lib/store";
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
  stats: AdminProductCatalogStats;
  filters: {
    q: string;
    category: string;
    brand: string;
    visibility: "all" | "visible" | "hidden";
    photo: "all" | "missing" | "with-photo";
    stock: "all" | "low" | "out";
    featured: "all" | "only";
    sync: "all" | "synced" | "unsynced" | "stale";
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

  if (filters.featured !== "all") {
    params.set("featured", filters.featured);
  }

  if (filters.sync !== "all") {
    params.set("sync", filters.sync);
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "Sin registro";
  }

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRelativeFreshness(value: string | null) {
  if (!value) {
    return "Sin sincronización";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours <= 0) {
    return "Hace menos de 1 hora";
  }

  if (diffHours < 24) {
    return `Hace ${diffHours} h`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Hace ${diffDays} d`;
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
  const [previewProductId, setPreviewProductId] = useState<string | null>(null);
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
  const previewProduct = previewProductId
    ? products.find((product) => product.id === previewProductId) ?? null
    : null;

  const selectedVisibleCount = selectedIds.filter((id) => {
    const product = products.find((item) => item.id === id);
    return product ? product.isVisible : false;
  }).length;
  const selectedHiddenCount = selectedCount - selectedVisibleCount;
  const selectedFeaturedCount = selectedIds.filter((id) => {
    const product = products.find((item) => item.id === id);
    return product ? product.isFeatured : false;
  }).length;
  const hasHardReview = stats.needsReviewProducts > 0;

  const quickFilters = [
    { label: "Sin stock", href: `/admin/products?${buildQuery(filters, { stock: "out" })}`, tone: stats.outOfStockProducts > 0 ? "warning" : "muted", count: stats.outOfStockProducts, icon: PackageX, active: filters.stock === "out" },
    { label: "Stock bajo", href: `/admin/products?${buildQuery(filters, { stock: "low" })}`, tone: stats.lowStockProducts > 0 ? "warning" : "muted", count: stats.lowStockProducts, icon: AlertTriangle, active: filters.stock === "low" },
    { label: "Sin imagen", href: `/admin/products?${buildQuery(filters, { photo: "missing" })}`, tone: stats.withoutPhotoProducts > 0 ? "danger" : "muted", count: stats.withoutPhotoProducts, icon: ImageOff, active: filters.photo === "missing" },
    { label: "Ocultos", href: `/admin/products?${buildQuery(filters, { visibility: "hidden" })}`, tone: stats.hiddenProducts > 0 ? "neutral" : "muted", count: stats.hiddenProducts, icon: EyeOff, active: filters.visibility === "hidden" },
    { label: "Destacados", href: `/admin/products?${buildQuery(filters, { featured: "only" })}`, tone: stats.featuredProducts > 0 ? "positive" : "muted", count: stats.featuredProducts, icon: Sparkles, active: filters.featured === "only" },
    { label: "Sin sync reciente", href: `/admin/products?${buildQuery(filters, { sync: "stale" })}`, tone: stats.staleSyncedProducts > 0 ? "warning" : "muted", count: stats.staleSyncedProducts, icon: RefreshCw, active: filters.sync === "stale" },
    { label: "ERP desconectado", href: `/admin/products?${buildQuery(filters, { sync: "unsynced" })}`, tone: stats.unsyncedProducts > 0 ? "danger" : "muted", count: stats.unsyncedProducts, icon: Truck, active: filters.sync === "unsynced" },
    { label: "Productos a revisar", href: `/admin/products?${buildQuery(filters, { issue: "review" })}`, tone: hasHardReview ? "danger" : "muted", count: stats.needsReviewProducts, icon: TriangleAlert, active: filters.issue === "review" },
  ] as const;

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

      <section className="admin-products-sanity-rail">
        <div className="panel-header admin-products-sanity-head">
          <div>
            <p className="eyebrow">Filtros rápidos</p>
            <h2>Refina el catálogo</h2>
          </div>
          <span className="muted">{selectedCount ? `${selectedCount} seleccionados` : "Sin selección"}</span>
        </div>
        <div className="admin-products-sanity-chips">
          {quickFilters.map((filter) => (
            <Link
              className={`admin-chip admin-chip-filter ${filter.active ? "is-active" : ""} is-${filter.tone}`}
              href={filter.href}
              key={filter.label}
            >
              <filter.icon size={14} />
              <span>{filter.label}</span>
              <strong>{filter.count}</strong>
            </Link>
          ))}
        </div>
      </section>

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
            <option value="out">Sin stock</option>
          </select>
          <select defaultValue={filters.featured} name="featured">
            <option value="all">Todos los destacados</option>
            <option value="only">Solo destacados</option>
          </select>
          <select defaultValue={filters.sync} name="sync">
            <option value="all">Toda la sync</option>
            <option value="synced">Sincronizados</option>
            <option value="unsynced">Sin sync</option>
            <option value="stale">Sin sync reciente</option>
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
          <span className="muted">
            {selectedVisibleCount} visibles · {selectedHiddenCount} ocultos · {selectedFeaturedCount} destacados
          </span>
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
                const isEffectivelyVisible = product.isVisible;
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
                        <button
                          className="icon-button"
                          aria-label={`Vista rápida de ${product.name}`}
                          onClick={() => setPreviewProductId(product.id)}
                          type="button"
                        >
                          <Eye size={16} />
                        </button>
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
          <article className="panel panel-slim empty-state admin-products-empty-state">
            <div className="admin-products-empty-icon">
              <Warehouse size={22} />
            </div>
            <div className="admin-products-empty-copy">
              <p className="eyebrow">Sin coincidencias</p>
              <h2>No hay productos con ese filtro</h2>
              <p className="panel-copy">
                Ajusta los filtros o crea un producto nuevo para seguir operando sin romper el ritmo del catálogo.
              </p>
            </div>
            <div className="admin-products-empty-actions">
              <Link className="button button-primary" href="/admin/products/new">
                <PencilLine size={16} />
                Crear producto
              </Link>
              <Link className="button button-secondary" href="/admin/products">
                <ArrowRight size={16} />
                Limpiar filtros
              </Link>
            </div>
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
                    void runSingleAction(activeProduct.isVisible ? "hide" : "show", activeProduct.id);
                  }}
                  type="button"
                >
                  {activeProduct.isVisible ? "Ocultar" : "Mostrar"}
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

      {previewProduct && typeof document !== "undefined"
        ? createPortal(
            <div className="admin-preview-backdrop" role="presentation" onClick={() => setPreviewProductId(null)}>
              <aside
                aria-label={`Vista rápida de ${previewProduct.name}`}
                className="admin-preview-drawer"
                role="dialog"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="admin-preview-head">
                  <div>
                    <p className="eyebrow">Vista rápida</p>
                    <h2>{previewProduct.name}</h2>
                    <p className="muted">{previewProduct.code} · {previewProduct.brand ?? "Sin marca"}</p>
                  </div>
                  <button className="icon-button" onClick={() => setPreviewProductId(null)} type="button">
                    <SquareCheckBig size={16} />
                  </button>
                </div>

                <div className="admin-preview-media">
                  {previewProduct.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={previewProduct.name}
                      className="admin-preview-image"
                      src={previewProduct.thumbnailUrl}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="admin-preview-empty-media">
                      <ImageOff size={26} />
                      <span>Sin imagen principal</span>
                    </div>
                  )}
                </div>

                <div className="admin-preview-metrics">
                  <article>
                    <span>Precio</span>
                    <strong>{formatCurrency(previewProduct.unitPrice)}</strong>
                  </article>
                  <article>
                    <span>Stock</span>
                    <strong>{previewProduct.stockUnits}</strong>
                  </article>
                  <article>
                    <span>Sync</span>
                    <strong>{formatRelativeFreshness(previewProduct.lastSyncedAt)}</strong>
                  </article>
                  <article>
                    <span>Estado</span>
                    <strong>{previewProduct.isVisible ? "Visible" : "Oculto"}</strong>
                  </article>
                </div>

                <div className="admin-preview-badges">
                  <span className={`status-badge ${previewProduct.isVisible ? "is-visible" : "is-hidden"}`}>
                    {previewProduct.isVisible ? "Publicado" : "Oculto"}
                  </span>
                  <span className={`status-badge ${previewProduct.hasPhoto ? "is-visible" : "is-warning"}`}>
                    {previewProduct.hasPhoto ? "Con foto" : "Sin foto"}
                  </span>
                  {previewProduct.isFeatured ? <span className="status-badge is-visible">Destacado</span> : null}
                  {previewProduct.stockUnits <= 12 ? (
                    <span className="status-badge is-warning">{previewProduct.stockUnits <= 0 ? "Sin stock" : "Stock bajo"}</span>
                  ) : null}
                </div>

                <div className="admin-preview-copy">
                  <div>
                    <span>Descripción</span>
                    <p>{previewProduct.name}</p>
                  </div>
                  <div>
                    <span>Última sincronización</span>
                    <p>{previewProduct.lastSyncedAt ? formatDateTime(previewProduct.lastSyncedAt) : "Sin sync reciente"}</p>
                  </div>
                </div>

                <div className="admin-preview-actions">
                  <Link className="button button-primary" href={`/admin/products/${previewProduct.id}`}>
                    <PencilLine size={16} />
                    Editar producto
                  </Link>
                  <Link className="button button-secondary" href={`/admin/products/${previewProduct.id}#media`}>
                    <ArrowRight size={16} />
                    Ir a media
                  </Link>
                </div>
              </aside>
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
