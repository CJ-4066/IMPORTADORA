"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type PublicStoreHeaderShellProps = {
  children: ReactNode;
};

export function PublicStoreHeaderShell({ children }: PublicStoreHeaderShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 760px)");

    const updateCollapsedState = () => {
      setCollapsed(mobileQuery.matches && window.scrollY > 18);
    };

    updateCollapsedState();

    window.addEventListener("scroll", updateCollapsedState, { passive: true });
    mobileQuery.addEventListener("change", updateCollapsedState);

    return () => {
      window.removeEventListener("scroll", updateCollapsedState);
      mobileQuery.removeEventListener("change", updateCollapsedState);
    };
  }, []);

  return (
    <div className={`public-store-header-shell${collapsed ? " is-collapsed" : ""}`}>
      {children}
    </div>
  );
}
