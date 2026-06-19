"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type PublicStoreHeaderState = {
  collapsed: boolean;
};

type PublicStoreHeaderShellProps = {
  children: ReactNode;
};

const PublicStoreHeaderStateContext = createContext<PublicStoreHeaderState | null>(null);

export function usePublicStoreHeaderState() {
  const state = useContext(PublicStoreHeaderStateContext);

  if (!state) {
    throw new Error("usePublicStoreHeaderState must be used within PublicStoreHeaderShell");
  }

  return state;
}

export function PublicStoreHeaderShell({ children }: PublicStoreHeaderShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 920px)");

    const updateCollapsedState = () => {
      setCollapsed(!media.matches && window.scrollY > 18);
    };

    updateCollapsedState();

    window.addEventListener("scroll", updateCollapsedState, { passive: true });
    window.addEventListener("resize", updateCollapsedState);
    media.addEventListener("change", updateCollapsedState);

    return () => {
      window.removeEventListener("scroll", updateCollapsedState);
      window.removeEventListener("resize", updateCollapsedState);
      media.removeEventListener("change", updateCollapsedState);
    };
  }, []);

  const value = useMemo(() => ({ collapsed }), [collapsed]);

  return (
    <PublicStoreHeaderStateContext.Provider value={value}>
      <div className={`public-store-header-shell${collapsed ? " is-collapsed" : ""}`}>
        {children}
      </div>
    </PublicStoreHeaderStateContext.Provider>
  );
}
