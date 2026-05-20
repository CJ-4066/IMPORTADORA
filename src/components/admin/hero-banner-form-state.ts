import type {
  HeroBannerContentPosition,
  HeroBannerLayout,
  HeroBannerSlot,
  HeroBannerTextAlign,
} from "@/lib/hero-banners";

export type HeroBannerFormValues = {
  bannerId: string;
  slot: HeroBannerSlot;
  layout: HeroBannerLayout;
  title: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  altText: string;
  overlayColor: string;
  overlayOpacity: string;
  textAlign: HeroBannerTextAlign;
  contentPosition: HeroBannerContentPosition;
  priority: string;
  sortOrder: string;
  campaignName: string;
  analyticsKey: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export type HeroBannerActionState = {
  message: string;
  fieldErrors: Partial<Record<keyof HeroBannerFormValues, string>>;
  values: HeroBannerFormValues;
};

const emptyHeroBannerActionState: HeroBannerActionState = {
  message: "",
  fieldErrors: {},
  values: {
    bannerId: "",
    slot: "HERO",
    layout: "HERO_DESKTOP_FULL",
    title: "",
    subtitle: "",
    description: "",
    ctaLabel: "",
    ctaHref: "",
    desktopImageUrl: "",
    mobileImageUrl: "",
    altText: "",
    overlayColor: "#000000",
    overlayOpacity: "0.36",
    textAlign: "LEFT",
    contentPosition: "LEFT",
    priority: "0",
    sortOrder: "0",
    campaignName: "",
    analyticsKey: "",
    startsAt: "",
    endsAt: "",
    isActive: true,
  },
};

export function getEmptyHeroBannerActionState(
  values?: Partial<HeroBannerFormValues>,
): HeroBannerActionState {
  return {
    message: "",
    fieldErrors: {},
    values: {
      ...emptyHeroBannerActionState.values,
      ...values,
    },
  };
}
