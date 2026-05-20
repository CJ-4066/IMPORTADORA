"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "admin-theme";

type AdminTheme = "light" | "dark";

function getStoredTheme(): AdminTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: AdminTheme) {
  document.body.dataset.adminTheme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function AdminThemeToggle() {
  const [theme, setTheme] = useState<AdminTheme>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const label = useMemo(
    () => (theme === "dark" ? "Modo oscuro" : "Modo claro"),
    [theme],
  );

  return (
    <button
      type="button"
      className={cn("admin-theme-toggle", theme === "dark" && "is-dark")}
      onClick={() => {
        const nextTheme: AdminTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? <MoonStar size={16} /> : <SunMedium size={16} />}
      <span>{label}</span>
    </button>
  );
}
