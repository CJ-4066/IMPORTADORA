"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { clearSession, requireAdmin } from "@/lib/auth";
import { parseFacturadorSyncMode, syncFacturadorProducts } from "@/lib/facturador/sync";
import { slugify } from "@/lib/utils";
import type {
  ProductActionState,
  ProductFormValues,
  ProductMediaFormValue,
} from "@/components/admin/product-form-state";
import {
  productMediaListSchema,
  parseCategoryForm,
  parseSettingsForm,
  productSchema,
} from "@/lib/validation";

async function resolveCategory(categoryId?: string) {
  if (!categoryId) {
    return {
      categoryId: null,
      category: null,
    };
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    return {
      categoryId: null,
      category: null,
    };
  }

  return {
    categoryId: category.id,
    category: category.name,
  };
}

function toRedirectError(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "Ya existe un registro con ese valor único. Revisa código, correo o nombre.";
  }

  return fallback;
}

function getProductFormValues(formData: FormData): ProductFormValues {
  const mediaTypes = formData.getAll("mediaType").map(String);
  const mediaUrls = formData.getAll("mediaUrl").map(String);
  const mediaAltTexts = formData.getAll("mediaAltText").map(String);

  return {
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    description: String(formData.get("description") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    media: mediaTypes.map((type, index) => ({
      type: type === "VIDEO" ? "VIDEO" : "IMAGE",
      url: mediaUrls[index] ?? "",
      altText: mediaAltTexts[index] ?? "",
    })),
    unitLabel: String(formData.get("unitLabel") ?? "unidad"),
    stockUnits: String(formData.get("stockUnits") ?? "0"),
    unitPrice: String(formData.get("unitPrice") ?? ""),
    wholesalePrice: String(formData.get("wholesalePrice") ?? ""),
    wholesaleMinQty: String(formData.get("wholesaleMinQty") ?? "3"),
    boxPrice: String(formData.get("boxPrice") ?? ""),
    unitsPerBox: String(formData.get("unitsPerBox") ?? ""),
    isVisible: formData.get("isVisible") === "on",
    isFeatured: formData.get("isFeatured") === "on",
  };
}

function parseProductMedia(
  mediaItems: ProductMediaFormValue[],
): Array<{ type: "IMAGE" | "VIDEO"; url: string; altText?: string; sortOrder: number }> {
  const filteredItems = mediaItems.filter(
    (item) => item.url.trim() !== "" || item.altText.trim() !== "",
  );

  return productMediaListSchema.parse(filteredItems).map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

function parseSyncMode(formData: FormData) {
  return parseFacturadorSyncMode(String(formData.get("syncMode") ?? ""));
}

function parseSyncReturnPath(formData: FormData) {
  const value = String(formData.get("returnTo") ?? "");

  if (value === "/admin" || value === "/admin/settings" || value === "/admin/erp") {
    return value;
  }

  return "/admin/erp";
}

function scheduleErpSync(options: Parameters<typeof syncFacturadorProducts>[0]) {
  setImmediate(() => {
    void syncFacturadorProducts(options)
      .catch((error) => {
        console.error("[ERP sync] background task failed:", error);
      })
      .finally(() => {
        revalidatePath("/");
        revalidatePath("/admin");
        revalidatePath("/admin/products");
        revalidatePath("/admin/settings");
        revalidatePath("/admin/erp");
        revalidatePath("/admin/categories");
      });
  });
}

function mapProductActionError(
  error: unknown,
  values: ProductFormValues,
  fallback: string,
): ProductActionState {
  if (error instanceof ZodError) {
    const fieldErrors: ProductActionState["fieldErrors"] = {};

    for (const issue of error.issues) {
      const fieldName = issue.path[0];

      if (typeof fieldName === "number") {
        fieldErrors.media ??= issue.message;
        continue;
      }

      if (typeof fieldName === "string" && !(fieldName in fieldErrors)) {
        fieldErrors[fieldName as keyof ProductFormValues] = issue.message;
      }
    }

    return {
      message: error.issues[0]?.message ?? fallback,
      fieldErrors,
      values,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return {
      message: "El código del producto ya existe. Usa otro código.",
      fieldErrors: {
        code: "El código del producto ya existe.",
      },
      values,
    };
  }

  return {
    message: fallback,
    fieldErrors: {},
    values,
  };
}

export async function createProductFormAction(
  _prevState: ProductActionState,
  formData: FormData,
) {
  await requireAdmin();
  const values = getProductFormValues(formData);

  try {
    const data = productSchema.parse(values);
    const category = await resolveCategory(data.categoryId);
    const media = parseProductMedia(values.media);

    await prisma.product.create({
      data: {
        ...data,
        ...category,
        slug: slugify(`${data.name}-${data.code}`),
        media: media.length
          ? {
              create: media,
            }
          : undefined,
      },
    });
  } catch (error) {
    return mapProductActionError(error, values, "No se pudo crear el producto.");
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin/products?status=created");
}

export async function updateProductFormAction(
  _prevState: ProductActionState,
  formData: FormData,
) {
  await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const values = getProductFormValues(formData);

  try {
    const data = productSchema.parse(values);
    const category = await resolveCategory(data.categoryId);
    const media = parseProductMedia(values.media);

    await prisma.product.update({
      where: { id: productId },
      data: {
        ...data,
        ...category,
        slug: slugify(`${data.name}-${data.code}`),
        media: {
          deleteMany: {},
          ...(media.length
            ? {
                create: media,
              }
            : {}),
        },
      },
    });
  } catch (error) {
    return mapProductActionError(error, values, "No se pudo actualizar el producto.");
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin/products/${productId}?status=updated`);
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}

export async function toggleProductVisibilityAction(formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const nextValue = String(formData.get("nextValue") ?? "") === "true";

  await prisma.product.update({
    where: { id: productId },
    data: { isVisible: nextValue },
  });

  revalidatePath("/");
  revalidatePath("/admin/products");
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get("productId") ?? "");

  await prisma.product.delete({
    where: { id: productId },
  });

  revalidatePath("/");
  revalidatePath("/admin/products");
  redirect("/admin/products?status=deleted");
}

export async function bulkProductAction(formData: FormData) {
  await requireAdmin();
  const action = String(formData.get("bulkAction") ?? "");
  const productIds = formData.getAll("productIds").map(String).filter(Boolean);

  if (!productIds.length) {
    redirect("/admin/products?status=no-selection");
  }

  if (action === "hide") {
    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { isVisible: false },
    });
    revalidatePath("/");
    revalidatePath("/admin/products");
    redirect("/admin/products?status=bulk-hidden");
  }

  if (action === "delete") {
    await prisma.product.deleteMany({
      where: { id: { in: productIds } },
    });
    revalidatePath("/");
    revalidatePath("/admin/products");
    redirect("/admin/products?status=bulk-deleted");
  }

  redirect("/admin/products?status=invalid-action");
}

export async function hideProductsWithoutPhotoAction() {
  await requireAdmin();

  await prisma.product.updateMany({
    where: {
      isVisible: true,
      imageUrl: null,
      media: { none: {} },
    },
    data: {
      isVisible: false,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  redirect("/admin/products?status=photo-hidden&visibility=hidden&photo=missing");
}

export async function updateSettingsAction(formData: FormData) {
  await requireAdmin();
  try {
    const data = parseSettingsForm(formData);

    await prisma.storeSettings.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        ...data,
      },
    });
  } catch (error) {
    const message = toRedirectError(error, "No se pudo actualizar la configuración.");
    redirect(`/admin/settings?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin/settings?status=updated");
}

export async function syncProductsFromErpAction(formData: FormData) {
  const session = await requireAdmin();
  const syncMode = parseSyncMode(formData);
  const returnTo = parseSyncReturnPath(formData);

  if (syncMode === "INCREMENTAL" && !process.env.FACTURADOR_SYNC_UPDATED_SINCE_PARAM?.trim()) {
    redirect(
      `${returnTo}?syncStatus=error&syncError=${encodeURIComponent(
        "El modo incremental requiere FACTURADOR_SYNC_UPDATED_SINCE_PARAM.",
      )}`,
    );
  }

  scheduleErpSync({
    trigger: "MANUAL",
    initiatedByName: session.name,
    initiatedByEmail: session.email,
    syncMode,
  });

  redirect(`${returnTo}?syncStatus=running&syncMode=${syncMode}`);
}

export async function cancelErpSyncAction(formData: FormData) {
  const session = await requireAdmin();
  const syncLogId = String(formData.get("syncLogId") ?? "");

  if (!syncLogId) {
    redirect("/admin/erp?syncStatus=error&syncError=No se encontró la sincronización.");
  }

  await prisma.erpSyncLog.updateMany({
    where: {
      id: syncLogId,
      status: "RUNNING",
    },
    data: {
      status: "CANCELED",
      cancelRequestedAt: new Date(),
      canceledByName: session.name,
      canceledByEmail: session.email,
      errorMessage: "Cancelada desde el panel administrativo.",
      finishedAt: new Date(),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/erp");
  redirect("/admin/erp?syncStatus=cancelled");
}

export async function createCategoryAction(formData: FormData) {
  await requireAdmin();
  try {
    const data = parseCategoryForm(formData);

    await prisma.category.create({
      data: {
        name: data.name,
        slug: slugify(data.name),
      },
    });
  } catch (error) {
    const message = toRedirectError(error, "No se pudo crear la categoría.");
    redirect(`/admin/categories?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products/new");
  redirect("/admin/categories?status=created");
}

export async function updateCategoryAction(formData: FormData) {
  await requireAdmin();
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    const data = parseCategoryForm(formData);

    await prisma.$transaction(async (tx) => {
      const category = await tx.category.update({
        where: { id: categoryId },
        data: {
          name: data.name,
          slug: slugify(data.name),
        },
      });

      await tx.product.updateMany({
        where: { categoryId: category.id },
        data: { category: category.name },
      });
    });
  } catch (error) {
    const message = toRedirectError(error, "No se pudo actualizar la categoría.");
    redirect(`/admin/categories?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  redirect("/admin/categories?status=updated");
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const categoryId = String(formData.get("categoryId") ?? "");

  await prisma.$transaction(async (tx) => {
    await tx.product.updateMany({
      where: { categoryId },
      data: {
        categoryId: null,
        category: null,
      },
    });

    await tx.category.delete({
      where: { id: categoryId },
    });
  });

  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  redirect("/admin/categories?status=deleted");
}
