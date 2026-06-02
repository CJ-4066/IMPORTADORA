import { mkdir } from "node:fs/promises";
import path from "node:path";
import { slugify } from "@/lib/utils";
import { createNormalizedProductImage } from "@/lib/product-image-normalization";

const PRODUCT_IMAGE_DIR = path.join(process.cwd(), "public", "uploads", "products");
const GENERIC_PRODUCT_IMAGE_MARKERS = [
  "imagen-no-disponible",
  "no-image",
  "placeholder",
  "sin-foto",
];

function isGenericImageUrl(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return false;
  }

  return GENERIC_PRODUCT_IMAGE_MARKERS.some((marker) => normalized.includes(marker));
}

function isMirrorableSourceUrl(value: string | null | undefined) {
  const raw = value?.trim();

  if (!raw || raw.startsWith("/")) {
    return false;
  }

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

async function downloadRemoteImage(sourceUrl: string) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ImportadoraImageMirror/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.startsWith("image/")) {
      throw new Error("La URL no devuelve una imagen válida.");
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export type MirrorProductImageInput = {
  code: string;
  sourceUrl: string | null | undefined;
  versionKey: string;
  previousLocalUrl?: string | null;
};

export type MirrorProductImageResult = {
  localUrl: string | null;
  mirrored: boolean;
  error?: string | null;
};

export async function mirrorProductImageToLocal(
  input: MirrorProductImageInput,
): Promise<MirrorProductImageResult> {
  const sourceUrl = input.sourceUrl?.trim() ?? "";

  if (!sourceUrl || isGenericImageUrl(sourceUrl) || !isMirrorableSourceUrl(sourceUrl)) {
    return {
      localUrl: input.previousLocalUrl ?? null,
      mirrored: false,
      error: null,
    };
  }

  try {
    const buffer = await downloadRemoteImage(sourceUrl);
    const fileBase = `erp-${slugify(input.code) || "product"}-${input.versionKey.slice(0, 10)}`;
    const filePath = path.join(PRODUCT_IMAGE_DIR, `${fileBase}.webp`);

    await mkdir(PRODUCT_IMAGE_DIR, { recursive: true });
    const image = await createNormalizedProductImage(buffer);
    await image
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(filePath);

    return {
      localUrl: `/uploads/products/${fileBase}.webp`,
      mirrored: true,
      error: null,
    };
  } catch (error) {
    return {
      localUrl: input.previousLocalUrl ?? null,
      mirrored: false,
      error: error instanceof Error ? error.message : "No se pudo guardar la imagen local.",
    };
  }
}
