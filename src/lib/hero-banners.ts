import type { HeroBanner as PrismaHeroBanner, Prisma } from "@prisma/client";

export const HERO_BANNER_LAYOUT_VALUES = [
  "HERO_DESKTOP_FULL",
  "HERO_MOBILE",
  "BANNER_SQUARE",
  "PROMO_STRIP",
] as const;

export const HERO_BANNER_SLOT_VALUES = [
  "HERO",
  "CATEGORY",
  "PROMO",
  "LANDING",
  "WIDGET",
] as const;

export const HERO_BANNER_TEXT_ALIGN_VALUES = ["LEFT", "CENTER", "RIGHT"] as const;
export const HERO_BANNER_CONTENT_POSITION_VALUES = ["LEFT", "CENTER", "RIGHT"] as const;

export type HeroBannerLayout = (typeof HERO_BANNER_LAYOUT_VALUES)[number];
export type HeroBannerSlot = (typeof HERO_BANNER_SLOT_VALUES)[number];
export type HeroBannerTextAlign = (typeof HERO_BANNER_TEXT_ALIGN_VALUES)[number];
export type HeroBannerContentPosition = (typeof HERO_BANNER_CONTENT_POSITION_VALUES)[number];

export type HeroBannerLayoutMeta = {
  layout: HeroBannerLayout;
  label: string;
  recommendedDesktopSize: string;
  recommendedMobileSize: string;
  ratioLabel: string;
  desktopAspectRatio: string;
  mobileAspectRatio: string;
  description: string;
};

export const HERO_BANNER_LAYOUTS: HeroBannerLayoutMeta[] = [
  {
    layout: "HERO_DESKTOP_FULL",
    label: "Hero Desktop Full",
    recommendedDesktopSize: "1920 x 700",
    recommendedMobileSize: "1080 x 1400",
    ratioLabel: "16:5.8",
    desktopAspectRatio: "16 / 5.8",
    mobileAspectRatio: "27 / 35",
    description: "Hero principal ancho para campañas, lanzamientos y ofertas generales.",
  },
  {
    layout: "HERO_MOBILE",
    label: "Hero Mobile",
    recommendedDesktopSize: "1600 x 900",
    recommendedMobileSize: "1080 x 1400",
    ratioLabel: "4:5",
    desktopAspectRatio: "16 / 9",
    mobileAspectRatio: "4 / 5.2",
    description: "Banner alto pensado para mobile-first y mensajes de impacto vertical.",
  },
  {
    layout: "BANNER_SQUARE",
    label: "Banner Cuadrado",
    recommendedDesktopSize: "1200 x 1200",
    recommendedMobileSize: "1200 x 1200",
    ratioLabel: "1:1",
    desktopAspectRatio: "1 / 1",
    mobileAspectRatio: "1 / 1",
    description: "Formato flexible para promos, categorías y landings modulares.",
  },
  {
    layout: "PROMO_STRIP",
    label: "Promo Strip",
    recommendedDesktopSize: "1920 x 400",
    recommendedMobileSize: "1080 x 540",
    ratioLabel: "24:5",
    desktopAspectRatio: "24 / 5",
    mobileAspectRatio: "2 / 1",
    description: "Franja promocional horizontal para anuncios cortos y llamadas a la acción.",
  },
];

export function getHeroBannerLayoutMeta(layout: HeroBannerLayout) {
  return HERO_BANNER_LAYOUTS.find((item) => item.layout === layout) ?? HERO_BANNER_LAYOUTS[0];
}

export type HeroBannerView = {
  id: string;
  slot: HeroBannerSlot;
  layout: HeroBannerLayout;
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
  priority: number;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  campaignName: string | null;
  analyticsKey: string | null;
  impressionCount: number;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
  statusLabel: "Activo" | "Programado" | "Expirado" | "Borrador";
  isLive: boolean;
  recommendedDesktopSize: string;
  recommendedMobileSize: string;
  ratioLabel: string;
};

export function isHeroBannerLive(
  banner: Pick<PrismaHeroBanner, "isActive" | "startsAt" | "endsAt">,
  now = new Date(),
) {
  if (!banner.isActive) {
    return false;
  }

  const started = !banner.startsAt || banner.startsAt <= now;
  const notExpired = !banner.endsAt || banner.endsAt >= now;

  return started && notExpired;
}

export function mapHeroBanner(banner: PrismaHeroBanner, now = new Date()): HeroBannerView {
  const layoutMeta = getHeroBannerLayoutMeta(banner.layout as HeroBannerLayout);
  const live = isHeroBannerLive(banner, now);
  const startsAt = banner.startsAt?.toISOString() ?? null;
  const endsAt = banner.endsAt?.toISOString() ?? null;
  const scheduled = Boolean(banner.startsAt && banner.startsAt > now);
  const expired = Boolean(banner.endsAt && banner.endsAt < now);

  return {
    id: banner.id,
    slot: banner.slot as HeroBannerSlot,
    layout: banner.layout as HeroBannerLayout,
    title: banner.title,
    subtitle: banner.subtitle,
    description: banner.description,
    ctaLabel: banner.ctaLabel,
    ctaHref: banner.ctaHref,
    desktopImageUrl: banner.desktopImageUrl,
    mobileImageUrl: banner.mobileImageUrl,
    altText: banner.altText,
    overlayColor: banner.overlayColor,
    overlayOpacity: banner.overlayOpacity,
    textAlign: banner.textAlign as HeroBannerTextAlign,
    contentPosition: banner.contentPosition as HeroBannerContentPosition,
    priority: banner.priority,
    sortOrder: banner.sortOrder,
    isActive: banner.isActive,
    startsAt,
    endsAt,
    campaignName: banner.campaignName,
    analyticsKey: banner.analyticsKey,
    impressionCount: banner.impressionCount,
    clickCount: banner.clickCount,
    createdAt: banner.createdAt.toISOString(),
    updatedAt: banner.updatedAt.toISOString(),
    statusLabel: !banner.isActive ? "Borrador" : expired ? "Expirado" : scheduled ? "Programado" : "Activo",
    isLive: live,
    recommendedDesktopSize: layoutMeta.recommendedDesktopSize,
    recommendedMobileSize: layoutMeta.recommendedMobileSize,
    ratioLabel: layoutMeta.ratioLabel,
  };
}

export function buildHeroBannerOrderBy() {
  return [
    { priority: "desc" as const },
    { sortOrder: "asc" as const },
    { startsAt: "asc" as const },
    { updatedAt: "desc" as const },
    { id: "asc" as const },
  ];
}

export function buildHeroBannerWhere(
  slot?: HeroBannerSlot,
  activeOnly = true,
  now = new Date(),
): Prisma.HeroBannerWhereInput | undefined {
  const conditions: Prisma.HeroBannerWhereInput[] = [];

  if (slot) {
    conditions.push({ slot });
  }

  if (activeOnly) {
    conditions.push({
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    });
  }

  if (!conditions.length) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return { AND: conditions };
}
