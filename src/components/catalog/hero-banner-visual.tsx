"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { getSafeMediaUrl } from "@/lib/media-url";
import {
  getHeroBannerLayoutMeta,
  type HeroBannerContentPosition,
  type HeroBannerLayout,
  type HeroBannerTextAlign,
} from "@/lib/hero-banners";

export type HeroBannerVisualData = {
  id?: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  desktopImageUrl: string;
  mobileImageUrl: string | null;
  altText: string | null;
  overlayColor: string;
  overlayOpacity: number;
  textAlign: HeroBannerTextAlign;
  contentPosition: HeroBannerContentPosition;
  layout: HeroBannerLayout;
  campaignName?: string | null;
};

type HeroBannerVisualProps = {
  banner: HeroBannerVisualData;
  className?: string;
  eager?: boolean;
  mode?: "auto" | "desktop" | "mobile";
};

function normalizeTextPosition(value: HeroBannerContentPosition) {
  switch (value) {
    case "CENTER":
      return "center";
    case "RIGHT":
      return "end";
    case "LEFT":
    default:
      return "start";
  }
}

function normalizeTextAlign(value: HeroBannerTextAlign) {
  switch (value) {
    case "CENTER":
      return "center";
    case "RIGHT":
      return "right";
    case "LEFT":
    default:
      return "left";
  }
}

function hexToRgba(hex: string, opacity: number) {
  const normalized = hex.trim().replace("#", "");

  if (normalized.length !== 6) {
    return `rgba(0, 0, 0, ${Math.max(0, Math.min(1, opacity))})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
}

export function HeroBannerVisual({
  banner,
  className,
  eager = false,
  mode = "auto",
}: HeroBannerVisualProps) {
  const layout = getHeroBannerLayoutMeta(banner.layout);
  const modeClass = mode === "mobile" ? "is-mobile-mode" : mode === "desktop" ? "is-desktop-mode" : "is-auto-mode";
  const desktopUrl = getSafeMediaUrl(banner.desktopImageUrl)?.trim() || "";
  const mobileUrl = banner.mobileImageUrl ? (getSafeMediaUrl(banner.mobileImageUrl)?.trim() || "") : "";
  const src = mode === "mobile" ? mobileUrl || desktopUrl : desktopUrl || mobileUrl;
  const hasMobileImage = mobileUrl.length > 0;
  const hasVisibleImage = src.length > 0;
  const overlayColor = hexToRgba(banner.overlayColor, banner.overlayOpacity);
  const textPosition = normalizeTextPosition(banner.contentPosition);
  const textAlign = normalizeTextAlign(banner.textAlign);
  const isInternalHref = Boolean(banner.ctaHref?.startsWith("/") || banner.ctaHref?.startsWith("?"));

  return (
    <article
      className={cn("hero-banner-visual", `is-${banner.layout.toLowerCase()}`, modeClass, className)}
      style={
        {
          "--hero-banner-aspect-ratio": layout.desktopAspectRatio,
          "--hero-banner-mobile-aspect-ratio": layout.mobileAspectRatio,
          "--hero-banner-overlay": overlayColor,
        } as CSSProperties
      }
    >
      {hasVisibleImage ? (
        mode === "auto" ? (
          <picture className="hero-banner-visual-media">
            {hasMobileImage ? <source media="(max-width: 767px)" srcSet={mobileUrl} /> : null}
            <img
              alt={banner.altText ?? banner.title ?? "Banner promocional"}
              decoding="async"
              fetchPriority={eager ? "high" : "auto"}
              loading={eager ? "eager" : "lazy"}
              referrerPolicy="no-referrer"
              src={desktopUrl}
            />
          </picture>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={banner.altText ?? banner.title ?? "Banner promocional"}
            className="hero-banner-visual-media"
            decoding="async"
            fetchPriority={eager ? "high" : "auto"}
            loading={eager ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            src={src}
          />
        )
      ) : (
        <div className="hero-banner-visual-placeholder" aria-hidden="true">
          <span>No hay imagen para previsualizar</span>
        </div>
      )}

      <div
        className="hero-banner-visual-overlay"
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${overlayColor} 100%)`,
          justifyItems: textPosition,
          textAlign,
        }}
      >
        <div className="hero-banner-visual-copy">
          {banner.campaignName ? <span className="hero-banner-chip">{banner.campaignName}</span> : null}
          {banner.subtitle ? <p className="hero-banner-subtitle">{banner.subtitle}</p> : null}
          {banner.title ? <h2>{banner.title}</h2> : null}
          {banner.description ? <p className="hero-banner-description">{banner.description}</p> : null}
          {banner.ctaHref && banner.ctaLabel ? (
            isInternalHref ? (
              <Link className="button button-primary hero-banner-cta" href={banner.ctaHref}>
                {banner.ctaLabel}
              </Link>
            ) : (
              <a
                className="button button-primary hero-banner-cta"
                href={banner.ctaHref}
                rel="noreferrer"
                target="_blank"
              >
                {banner.ctaLabel}
              </a>
            )
          ) : null}
        </div>
      </div>
    </article>
  );
}
