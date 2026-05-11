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
