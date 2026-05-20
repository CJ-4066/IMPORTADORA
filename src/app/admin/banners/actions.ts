"use server";

import { Prisma, type HeroBanner as PrismaHeroBanner } from "@prisma/client";
import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmptyHeroBannerActionState, type HeroBannerActionState, type HeroBannerFormValues } from "@/components/admin/hero-banner-form-state";
import { parseHeroBannerForm } from "@/lib/validation";
import { buildHeroBannerOrderBy, mapHeroBanner } from "@/lib/hero-banners";

function toRedirectError(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "Ya existe un banner con ese valor único.";
  }

  return fallback;
}

function getHeroBannerFormValues(formData: FormData): HeroBannerFormValues {
  return {
    bannerId: String(formData.get("bannerId") ?? ""),
    slot: String(formData.get("slot") ?? "HERO") as HeroBannerFormValues["slot"],
    layout: String(formData.get("layout") ?? "HERO_DESKTOP_FULL") as HeroBannerFormValues["layout"],
    title: String(formData.get("title") ?? ""),
    subtitle: String(formData.get("subtitle") ?? ""),
    description: String(formData.get("description") ?? ""),
    ctaLabel: String(formData.get("ctaLabel") ?? ""),
    ctaHref: String(formData.get("ctaHref") ?? ""),
    desktopImageUrl: String(formData.get("desktopImageUrl") ?? ""),
    mobileImageUrl: String(formData.get("mobileImageUrl") ?? ""),
    altText: String(formData.get("altText") ?? ""),
    overlayColor: String(formData.get("overlayColor") ?? "#000000"),
    overlayOpacity: String(formData.get("overlayOpacity") ?? "0.36"),
    textAlign: String(formData.get("textAlign") ?? "LEFT") as HeroBannerFormValues["textAlign"],
    contentPosition: String(formData.get("contentPosition") ?? "LEFT") as HeroBannerFormValues["contentPosition"],
    priority: String(formData.get("priority") ?? "0"),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
    campaignName: String(formData.get("campaignName") ?? ""),
    analyticsKey: String(formData.get("analyticsKey") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    isActive: formData.get("isActive") === "on",
  };
}

function bannerToActionState(
  banner: PrismaHeroBanner | null,
  valuesOverride?: Partial<HeroBannerFormValues>,
): HeroBannerActionState {
  if (!banner) {
    return getEmptyHeroBannerActionState(valuesOverride);
  }

  return getEmptyHeroBannerActionState({
    bannerId: banner.id,
    slot: banner.slot as HeroBannerFormValues["slot"],
    layout: banner.layout as HeroBannerFormValues["layout"],
    title: banner.title ?? "",
    subtitle: banner.subtitle ?? "",
    description: banner.description ?? "",
    ctaLabel: banner.ctaLabel ?? "",
    ctaHref: banner.ctaHref ?? "",
    desktopImageUrl: banner.desktopImageUrl,
    mobileImageUrl: banner.mobileImageUrl ?? "",
    altText: banner.altText ?? "",
    overlayColor: banner.overlayColor,
    overlayOpacity: String(banner.overlayOpacity),
    textAlign: banner.textAlign as HeroBannerFormValues["textAlign"],
    contentPosition: banner.contentPosition as HeroBannerFormValues["contentPosition"],
    priority: String(banner.priority),
    sortOrder: String(banner.sortOrder),
    campaignName: banner.campaignName ?? "",
    analyticsKey: banner.analyticsKey ?? "",
    startsAt: banner.startsAt ? banner.startsAt.toISOString().slice(0, 16) : "",
    endsAt: banner.endsAt ? banner.endsAt.toISOString().slice(0, 16) : "",
    isActive: banner.isActive,
    ...valuesOverride,
  });
}

function mapBannerActionError(
  error: unknown,
  values: HeroBannerFormValues,
  fallback: string,
): HeroBannerActionState {
  if (error instanceof ZodError) {
    const fieldErrors: HeroBannerActionState["fieldErrors"] = {};

    for (const issue of error.issues) {
      const fieldName = issue.path[0];

      if (typeof fieldName === "string" && !(fieldName in fieldErrors)) {
        fieldErrors[fieldName as keyof HeroBannerFormValues] = issue.message;
      }
    }

    return {
      message: error.issues[0]?.message ?? fallback,
      fieldErrors,
      values,
    };
  }

  return {
    message: toRedirectError(error, fallback),
    fieldErrors: {},
    values,
  };
}

async function nextHeroSortOrder(slot: string) {
  const result = await prisma.heroBanner.aggregate({
    where: { slot: slot as HeroBannerFormValues["slot"] },
    _max: { sortOrder: true },
  });

  return (result._max.sortOrder ?? -1) + 1;
}

function parseList(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export async function upsertHeroBannerAction(
  _prevState: HeroBannerActionState,
  formData: FormData,
) {
  await requireAdmin();
  const values = getHeroBannerFormValues(formData);
  let bannerId = "";

  try {
    const data = parseHeroBannerForm(formData);
    const desktopImageUrl = data.desktopImageUrl.trim();
    const mobileImageUrl = data.mobileImageUrl?.trim() ?? "";
    bannerId = data.bannerId?.trim() ?? "";

    const payload = {
      slot: data.slot,
      layout: data.layout,
      title: data.title ?? null,
      subtitle: data.subtitle ?? null,
      description: data.description ?? null,
      ctaLabel: data.ctaLabel ?? null,
      ctaHref: data.ctaHref ?? null,
      desktopImageUrl,
      mobileImageUrl: mobileImageUrl || null,
      altText: data.altText ?? null,
      overlayColor: data.overlayColor,
      overlayOpacity: data.overlayOpacity,
      textAlign: data.textAlign,
      contentPosition: data.contentPosition,
      priority: data.priority,
      sortOrder: data.sortOrder,
      campaignName: data.campaignName ?? null,
      analyticsKey: data.analyticsKey ?? null,
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
      isActive: data.isActive,
    };

    if (bannerId) {
      await prisma.heroBanner.update({
        where: { id: bannerId },
        data: payload,
      });
    } else {
      const sortOrder = Number.isFinite(payload.sortOrder) ? payload.sortOrder : await nextHeroSortOrder(payload.slot);

      const created = await prisma.heroBanner.create({
        data: {
          ...payload,
          sortOrder,
        },
      });

      revalidatePath("/");
      revalidatePath("/admin");
      revalidatePath("/admin/banners");
      redirect(`/admin/banners?banner=${created.id}&status=created`);
    }
  } catch (error) {
    return mapBannerActionError(error, values, "No se pudo guardar el banner.");
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/banners");
  redirect(bannerId ? `/admin/banners?banner=${bannerId}&status=updated` : "/admin/banners?status=saved");
}

export async function toggleHeroBannerAction(formData: FormData) {
  await requireAdmin();
  const bannerId = String(formData.get("bannerId") ?? "");

  if (!bannerId) {
    redirect("/admin/banners?error=Banner%20inv%C3%A1lido");
  }

  const banner = await prisma.heroBanner.findUnique({ where: { id: bannerId } });

  if (!banner) {
    redirect("/admin/banners?error=Banner%20no%20encontrado");
  }

  await prisma.heroBanner.update({
    where: { id: bannerId },
    data: { isActive: !banner.isActive },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/banners");
  redirect(`/admin/banners?banner=${bannerId}&status=toggled`);
}

export async function deleteHeroBannerAction(formData: FormData) {
  await requireAdmin();
  const bannerId = String(formData.get("bannerId") ?? "");

  if (!bannerId) {
    redirect("/admin/banners?error=Banner%20inv%C3%A1lido");
  }

  await prisma.heroBanner.delete({ where: { id: bannerId } });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/banners");
  redirect("/admin/banners?status=deleted");
}

export async function duplicateHeroBannerAction(formData: FormData) {
  await requireAdmin();
  const bannerId = String(formData.get("bannerId") ?? "");
  const source = await prisma.heroBanner.findUnique({ where: { id: bannerId } });

  if (!source) {
    redirect("/admin/banners?error=Banner%20no%20encontrado");
  }

  const sortOrder = await nextHeroSortOrder(source.slot);

  const created = await prisma.heroBanner.create({
    data: {
      slot: source.slot,
      layout: source.layout,
      title: source.title ? `${source.title} (copia)` : "Banner duplicado",
      subtitle: source.subtitle,
      description: source.description,
      ctaLabel: source.ctaLabel,
      ctaHref: source.ctaHref,
      desktopImageUrl: source.desktopImageUrl,
      mobileImageUrl: source.mobileImageUrl,
      altText: source.altText,
      overlayColor: source.overlayColor,
      overlayOpacity: source.overlayOpacity,
      textAlign: source.textAlign,
      contentPosition: source.contentPosition,
      priority: source.priority,
      sortOrder,
      isActive: false,
      startsAt: source.startsAt,
      endsAt: source.endsAt,
      campaignName: source.campaignName,
      analyticsKey: source.analyticsKey,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/banners");
  redirect(`/admin/banners?banner=${created.id}&status=duplicated`);
}

export async function reorderHeroBannersAction(formData: FormData) {
  await requireAdmin();
  const orderIds = parseList(formData.get("orderIds"));

  if (!orderIds.length) {
    redirect("/admin/banners?error=Orden%20inv%C3%A1lido");
  }

  await prisma.$transaction(
    orderIds.map((id, index) =>
      prisma.heroBanner.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/banners");
  redirect("/admin/banners?status=reordered");
}

export async function importLegacyHeroSlidesAction() {
  await requireAdmin();

  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  const existingCount = await prisma.heroBanner.count({
    where: { slot: "HERO" },
  });

  if (!settings?.heroSlides || existingCount > 0) {
    redirect("/admin/banners?status=import-skipped");
  }

  const items = Array.isArray(settings.heroSlides) ? settings.heroSlides : [];
  const banners = items.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const imageUrl = typeof record.imageUrl === "string" ? record.imageUrl.trim() : "";

    if (!imageUrl) {
      return [];
    }

    return [
      {
        slot: "HERO" as const,
        layout: "HERO_DESKTOP_FULL" as const,
        title: typeof record.title === "string" ? record.title : null,
        subtitle: null,
        description: typeof record.text === "string" ? record.text : null,
        ctaLabel: null,
        ctaHref: null,
        desktopImageUrl: imageUrl,
        mobileImageUrl: null,
        altText: typeof record.title === "string" ? record.title : null,
        overlayColor: "#000000",
        overlayOpacity: 0.34,
        textAlign: "LEFT" as const,
        contentPosition: "LEFT" as const,
        priority: 0,
        sortOrder: index,
        isActive: true,
        startsAt: null,
        endsAt: null,
        campaignName: "Legacy hero",
        analyticsKey: null,
      },
    ];
  });

  if (!banners.length) {
    redirect("/admin/banners?error=No%20hay%20slides%20legados");
  }

  await prisma.heroBanner.createMany({
    data: banners,
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/banners");
  redirect("/admin/banners?status=imported");
}

export async function getHeroBannerEditorState(bannerId?: string | null) {
  const banner = bannerId
    ? await prisma.heroBanner.findUnique({
        where: { id: bannerId },
      })
    : null;

  if (banner) {
    return bannerToActionState(banner);
  }

  const nextSortOrder = await nextHeroSortOrder("HERO");

  return getEmptyHeroBannerActionState({
    sortOrder: String(nextSortOrder),
  });
}

export async function getHeroBannersForAdmin() {
  const banners = await prisma.heroBanner.findMany({
    orderBy: buildHeroBannerOrderBy(),
  });

  return banners.map((banner) => mapHeroBanner(banner));
}
