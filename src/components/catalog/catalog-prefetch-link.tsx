"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CatalogPrefetchLinkProps = {
  children: ReactNode;
  className?: string;
  href: string;
};

const prefetchedHrefs = new Set<string>();

export function CatalogPrefetchLink({
  children,
  className,
  href,
}: CatalogPrefetchLinkProps) {
  const router = useRouter();

  const prefetch = () => {
    if (prefetchedHrefs.has(href)) {
      return;
    }

    prefetchedHrefs.add(href);
    router.prefetch(href);
  };

  return (
    <Link
      className={className}
      href={href}
      onFocus={prefetch}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
    >
      {children}
    </Link>
  );
}
