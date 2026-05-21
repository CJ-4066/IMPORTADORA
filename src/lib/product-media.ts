const GENERIC_PRODUCT_PHOTO_MARKERS = [
  "imagen-no-disponible",
  "no-image",
  "placeholder",
  "sin-foto",
];

export function isGenericProductMediaUrl(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return false;
  }

  return GENERIC_PRODUCT_PHOTO_MARKERS.some((marker) => normalized.includes(marker));
}

type ProductMediaSource = {
  localImageUrl?: string | null;
  imageUrl?: string | null;
  media?: Array<{ url: string }>;
};

export function getPreferredProductImageUrl(product: ProductMediaSource) {
  const localImageUrl = product.localImageUrl?.trim() ?? "";

  if (localImageUrl) {
    return localImageUrl;
  }

  const mediaUrl = product.media?.find((item) => {
    const value = item.url.trim();
    return value.length > 0 && !isGenericProductMediaUrl(value);
  })?.url;

  if (mediaUrl) {
    return mediaUrl.trim();
  }

  const imageUrl = product.imageUrl?.trim() ?? "";

  if (imageUrl && !isGenericProductMediaUrl(imageUrl)) {
    return imageUrl;
  }

  return null;
}
