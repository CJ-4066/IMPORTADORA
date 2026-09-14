const DEFAULT_PUBLIC_SITE_URL = "https://tiendavirtualsuper.com";

function normalizeUrlOrigin(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    try {
      return new URL(`https://${trimmed}`).origin;
    } catch {
      return null;
    }
  }
}

export function getPublicSiteUrl() {
  return (
    normalizeUrlOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeUrlOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeUrlOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    DEFAULT_PUBLIC_SITE_URL
  );
}

export function buildPublicUrl(path: string) {
  return new URL(path, getPublicSiteUrl()).toString();
}
