const UPLOAD_CACHE_VERSION = "20261103";

export function getSafeMediaUrl(url: string | null | undefined) {
  const value = url?.trim();

  if (!value) {
    return null;
  }

  if (value.startsWith("/")) {
    return encodeURI(value);
  }

  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol === "http:") {
      parsedUrl.protocol = "https:";
    }

    return parsedUrl.toString();
  } catch {
    return encodeURI(value);
  }
}

export function getVersionedUploadUrl(url: string | null | undefined) {
  const safeUrl = getSafeMediaUrl(url);

  if (!safeUrl || !safeUrl.startsWith("/uploads/") || /[?&]assetv=/.test(safeUrl)) {
    return safeUrl;
  }

  const [path, hash] = safeUrl.split("#", 2);
  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}assetv=${UPLOAD_CACHE_VERSION}${hash ? `#${hash}` : ""}`;
}

export function getOptimizedImageUrl(
  url: string | null | undefined,
  width = 384,
  quality = 75,
) {
  const safeUrl = getSafeMediaUrl(url);

  if (!safeUrl) {
    return null;
  }

  if (safeUrl.startsWith("/_next/image")) {
    return safeUrl;
  }

  const cacheVersion = safeUrl.startsWith("/uploads/") ? `&assetv=${UPLOAD_CACHE_VERSION}` : "";

  return `/_next/image?url=${encodeURIComponent(safeUrl)}&w=${width}&q=${quality}${cacheVersion}`;
}

