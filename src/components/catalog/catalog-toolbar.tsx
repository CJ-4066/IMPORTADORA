"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Filter, LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import type { BrandOption, CatalogSuggestion, CategoryOption } from "@/lib/store";

type CatalogToolbarProps = {
  brand: string;
  brands: BrandOption[];
  collection?: string;
  q: string;
  category: string;
  totalResults: number;
  page: number;
  totalPages: number;
  categories: CategoryOption[];
  featuredOnly?: boolean;
  focusSearch?: boolean;
};

type ToolbarFilterSharedProps = {
  brand: string;
  brands: BrandOption[];
  categories: CategoryOption[];
  category: string;
  collection?: string;
  featuredOnly?: boolean;
  q: string;
};

function ActiveFilterSummary({
  q,
  category,
  brand,
  featuredOnly,
  categories,
}: ToolbarFilterSharedProps) {
  const activeCategory = useMemo(
    () => categories.find((item) => item.slug === category),
    [categories, category],
  );

  if (!q && (!category || category === "all") && (!brand || brand === "all") && !featuredOnly) {
    return (
      <div className="toolbar-empty-copy">
        <span>Todos los productos</span>
      </div>
    );
  }

  return (
    <div className="toolbar-active-tags">
      {q ? <span className="toolbar-pill">Búsqueda: {q}</span> : null}
      {activeCategory ? <span className="toolbar-pill">Categoría: {activeCategory.name}</span> : null}
      {brand && brand !== "all" ? <span className="toolbar-pill">Marca: {brand}</span> : null}
      {featuredOnly ? <span className="toolbar-pill">Promociones activas</span> : null}
    </div>
  );
}

function FilterForm({
  q,
  category,
  collection,
  brand,
  brands,
  featuredOnly,
  categories,
  onSubmit,
  inputId,
}: ToolbarFilterSharedProps & {
  onSubmit?: () => void;
  inputId: string;
}) {
  const [query, setQuery] = useState(q);
  const [suggestions, setSuggestions] = useState<CatalogSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        const response = await fetch(`/api/catalog-suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { suggestions?: CatalogSuggestion[] };
        setSuggestions(data.suggestions ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoadingSuggestions(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  return (
    <form className="filters-form" method="GET" onSubmit={onSubmit}>
      {collection ? <input name="collection" type="hidden" value={collection} /> : null}
      {featuredOnly ? <input name="featured" type="hidden" value="1" /> : null}
      <div className="search-field-shell">
        <label className="search-field">
          <Search size={18} />
          <input
            autoComplete="off"
            id={inputId}
            name="q"
            onBlur={() => {
              window.setTimeout(() => setSuggestionsOpen(false), 120);
            }}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setSuggestionsOpen(true)}
            placeholder="Busca por código, nombre o marca..."
            value={query}
          />
          {loadingSuggestions ? <LoaderCircle className="search-field-spinner" size={16} /> : null}
        </label>

        {suggestionsOpen && query.trim().length >= 2 ? (
          <div className="search-suggestions-panel">
            {suggestions.length ? (
              suggestions.map((item) => (
                <Link
                  className="search-suggestion-item"
                  href={`/producto/${item.slug}`}
                  key={item.id}
                  onClick={() => setSuggestionsOpen(false)}
                >
                  <div className="search-suggestion-main">
                    <strong>{item.name}</strong>
                    <span>
                      {item.brand ?? item.category ?? "Catálogo"} · {item.code}
                    </span>
                  </div>
                  {item.category ? <small>{item.category}</small> : null}
                </Link>
              ))
            ) : (
              <div className="search-suggestion-empty">
                <strong>Sin coincidencias rápidas</strong>
                <span>Presiona aplicar filtros para buscar en todo el catálogo.</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <select defaultValue={category} name="category">
        <option value="all">Todas las categorías</option>
        {categories.map((item) => (
          <option key={item.id} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>

      <select defaultValue={brand} name="brand">
        <option value="all">Todas las marcas</option>
        {brands.map((item) => (
          <option key={item.name} value={item.name}>
            {item.name}
          </option>
        ))}
      </select>

      <button className="button button-primary" type="submit">
        <Filter size={16} />
        Aplicar filtros
      </button>
    </form>
  );
}

function focusCatalogSearch() {
  if (window.innerWidth <= 920) {
    const trigger = document.getElementById(
      "catalog-mobile-search-trigger",
    ) as HTMLButtonElement | null;
    trigger?.click();
    window.setTimeout(() => {
      const mobileInput = document.getElementById(
        "catalog-mobile-search-input",
      ) as HTMLInputElement | null;
      mobileInput?.focus();
    }, 220);
    return;
  }

  const desktopInput = document.getElementById("catalog-search-input") as HTMLInputElement | null;
  if (desktopInput) {
    desktopInput.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      desktopInput.focus();
      desktopInput.select();
    }, 180);
  }
}

function DesktopToolbar(props: ToolbarFilterSharedProps) {
  const { brand, brands, categories, category, featuredOnly, q } = props;

  return (
    <div className="filters-desktop">
      <div className="filters-desktop-head">
        <div className="stack-xs">
          <p className="eyebrow">Explora el catálogo</p>
          <h2>Busca, filtra y compara sin salir de la tienda</h2>
        </div>
        <ActiveFilterSummary
          categories={categories}
          category={category}
          featuredOnly={featuredOnly}
          brand={brand}
          brands={brands}
          q={q}
        />
      </div>

      <FilterForm
        categories={categories}
        category={category}
        collection={props.collection}
        featuredOnly={featuredOnly}
        brand={brand}
        brands={brands}
        inputId="catalog-search-input"
        key={`desktop:${props.collection ?? "all"}:${q}:${category}:${featuredOnly ? "1" : "0"}`}
        q={q}
      />
    </div>
  );
}

function MobileToolbar({
  mobileOpen,
  onClose,
  onOpen,
  page,
  totalPages,
  totalResults,
  ...sharedProps
}: ToolbarFilterSharedProps & {
  mobileOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  page: number;
  totalPages: number;
  totalResults: number;
}) {
  const { brand, brands, categories, category, featuredOnly, q } = sharedProps;

  return (
    <>
      <div className="filters-mobile">
        <div className="mobile-toolbar">
          <div className="mobile-toolbar-copy">
            <p className="eyebrow">Explorar catálogo</p>
            <strong>{totalResults} productos</strong>
            <span>
              Página {page} de {totalPages}
            </span>
          </div>

          <button
            className="button button-primary mobile-filter-button"
            id="catalog-mobile-search-trigger"
            onClick={onOpen}
            type="button"
          >
            <SlidersHorizontal size={16} />
            Buscar y filtrar
          </button>
        </div>

        <ActiveFilterSummary
          categories={categories}
          category={category}
          featuredOnly={featuredOnly}
          brand={brand}
          brands={brands}
          q={q}
        />
      </div>
      <div className={`mobile-filter-overlay ${mobileOpen ? "is-open" : ""}`}>
        <button
          aria-label="Cerrar filtros"
          className="mobile-filter-backdrop"
          onClick={onClose}
          type="button"
        />

        <aside className="mobile-filter-sheet">
          <div className="mobile-filter-head">
            <div>
              <p className="eyebrow">Buscar y filtrar</p>
              <h2>Encuentra el producto rápido</h2>
            </div>
            <button className="icon-button" onClick={onClose} type="button">
              <X size={18} />
            </button>
          </div>

          <p className="panel-copy">
            Filtra por texto o categoría y vuelve al catálogo sin perder contexto.
          </p>

          <FilterForm
            categories={categories}
            category={category}
            collection={sharedProps.collection}
            featuredOnly={featuredOnly}
            brand={brand}
            brands={brands}
            inputId="catalog-mobile-search-input"
            key={`mobile:${sharedProps.collection ?? "all"}:${q}:${category}:${featuredOnly ? "1" : "0"}`}
            onSubmit={onClose}
            q={q}
          />
        </aside>
      </div>
    </>
  );
}

export function CatalogToolbar({
  brand,
  brands,
  collection,
  q,
  category,
  totalResults,
  page,
  totalPages,
  categories,
  featuredOnly = false,
  focusSearch = false,
}: CatalogToolbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!focusSearch) {
      return;
    }

    focusCatalogSearch();
  }, [focusSearch]);

  return (
    <>
      <DesktopToolbar
        brand={brand}
        brands={brands}
        categories={categories}
        category={category}
        collection={collection}
        featuredOnly={featuredOnly}
        q={q}
      />
      <MobileToolbar
        brand={brand}
        brands={brands}
        categories={categories}
        category={category}
        collection={collection}
        featuredOnly={featuredOnly}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onOpen={() => setMobileOpen(true)}
        page={page}
        q={q}
        totalPages={totalPages}
        totalResults={totalResults}
      />
    </>
  );
}
