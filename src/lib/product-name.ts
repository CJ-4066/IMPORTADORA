export function getPublicProductName(name: string) {
  const cleaned = name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || name.trim();
}
