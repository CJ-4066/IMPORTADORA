"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { getPublicProductName } from "@/lib/product-name";
import type { CatalogSuggestion } from "@/lib/store";

type HeaderSearchProps = {
  autoFocus?: boolean;
};

export function HeaderSearch({ autoFocus = false }: HeaderSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<CatalogSuggestion[]>([]);

  function focusSearchInput(shouldScroll = false) {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    if (shouldScroll) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    input.focus({ preventScroll: true });
    setOpen(true);
  }

  useEffect(() => {
    const handleFocusSearch = () => {
      focusSearchInput(true);
    };

    window.addEventListener("catalog:focus-search", handleFocusSearch);

    return () => {
      window.removeEventListener("catalog:focus-search", handleFocusSearch);
    };
  }, []);

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

  async function resolveSearchDestination(trimmedQuery: string) {
    const normalizedQuery = trimmedQuery.toLowerCase();
    const localMatch = suggestions.find((item) => {
      const code = item.code.trim().toLowerCase();
      const slug = item.slug.trim().toLowerCase();
      const name = item.name.trim().toLowerCase();

      return normalizedQuery === code || normalizedQuery === slug || normalizedQuery === name;
    });

    if (localMatch) {
      return `/producto/${localMatch.slug}`;
    }

    const response = await fetch(`/api/catalog-suggest?q=${encodeURIComponent(trimmedQuery)}`);

    if (!response.ok) {
      return `/?q=${encodeURIComponent(trimmedQuery)}`;
    }

    const data = (await response.json()) as { suggestions?: CatalogSuggestion[] };
    const remoteMatch = (data.suggestions ?? []).find((item) => {
      const code = item.code.trim().toLowerCase();
      const slug = item.slug.trim().toLowerCase();
      const name = item.name.trim().toLowerCase();

      return normalizedQuery === code || normalizedQuery === slug || normalizedQuery === name;
    });

    return remoteMatch ? `/producto/${remoteMatch.slug}` : `/?q=${encodeURIComponent(trimmedQuery)}`;
  }

  return (
    <form
      action="/"
      className="public-store-search-form"
      method="get"
      onSubmit={async (event) => {
        event.preventDefault();

        const trimmedQuery = query.trim();

        if (!trimmedQuery) {
          return;
        }

        setLoading(true);

        try {
          const destination = await resolveSearchDestination(trimmedQuery);
          router.push(destination);
        } finally {
          setLoading(false);
        }
      }}
      role="search"
    >
      <label
        className="public-store-search-field"
        onPointerDownCapture={() => focusSearchInput()}
        onTouchStartCapture={() => focusSearchInput()}
      >
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
          aria-label="Buscar producto o código"
          placeholder=""
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
                    <strong>{getPublicProductName(item.name)}</strong>
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
