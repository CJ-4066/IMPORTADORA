"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import type { CatalogSuggestion } from "@/lib/store";

type HeaderSearchProps = {
  autoFocus?: boolean;
};

export function HeaderSearch({ autoFocus = false }: HeaderSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<CatalogSuggestion[]>([]);

  function focusSearchInput() {
    inputRef.current?.focus();
  }

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true);
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
        setLoading(false);
      }
    }, 160);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  return (
    <form action="/" className="public-store-search-form" method="get" role="search">
      <label
        className="public-store-search-field"
        onPointerDownCapture={focusSearchInput}
        onTouchStartCapture={focusSearchInput}
      >
        <Search size={18} />
        <input
          autoComplete="off"
          autoFocus={autoFocus}
          id="store-header-search-input"
          name="q"
          enterKeyHint="search"
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);

            if (nextValue.trim().length < 2) {
              setSuggestions([]);
              setLoading(false);
            }
          }}
          onFocus={() => setOpen(true)}
          inputMode="search"
          placeholder="Buscar producto o código"
          ref={inputRef}
          type="search"
          value={query}
        />
        {loading ? <LoaderCircle className="search-field-spinner" size={16} /> : null}
        <button aria-label="Buscar" className="public-store-search-submit" type="submit">
          <Search size={16} />
        </button>

        {open && query.trim().length >= 2 ? (
          <div className="search-suggestions-panel public-store-suggestions-panel">
            {suggestions.length ? (
              suggestions.map((item) => (
                <Link
                  className="search-suggestion-item"
                  href={`/producto/${item.slug}`}
                  key={item.id}
                  onClick={() => setOpen(false)}
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
                <span>Presiona buscar para revisar todo el catálogo.</span>
              </div>
            )}
          </div>
        ) : null}
      </label>
    </form>
  );
}
