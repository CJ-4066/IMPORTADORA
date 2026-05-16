import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const allowedFolders = new Set(["products", "hero", "categories"]);

function sanitizeBaseName(value: string) {
  return value
    .trim()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getExtension(file: File) {
  const nameExtension = path.extname(file.name).toLowerCase();

  if (nameExtension && nameExtension.length <= 6) {
    return nameExtension;
  }

  if (file.type.startsWith("image/")) {
    if (file.type === "image/jpeg") return ".jpg";
    if (file.type === "image/png") return ".png";
    if (file.type === "image/webp") return ".webp";
    if (file.type === "image/gif") return ".gif";
    if (file.type === "image/svg+xml") return ".svg";
    return ".img";
  }

  if (file.type.startsWith("video/")) {
    if (file.type === "video/mp4") return ".mp4";
    if (file.type === "video/webm") return ".webm";
    if (file.type === "video/quicktime") return ".mov";
    return ".video";
  }

  return ".bin";
}

export async function POST(request: Request) {
  await requireAdmin();

  const formData = await request.formData();
  const fileEntry = formData.get("file");
  const folderValue = String(formData.get("folder") ?? "products").trim();
  const folder = allowedFolders.has(folderValue) ? folderValue : "products";

  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: "Selecciona un archivo válido." }, { status: 400 });
  }

  if (fileEntry.size <= 0) {
    return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });
  }

  const maxSize = 25 * 1024 * 1024;

  if (fileEntry.size > maxSize) {
    return NextResponse.json(
      { error: "El archivo supera el tamaño permitido de 25 MB." },
      { status: 413 },
    );
  }

  const uploadedAt = Date.now();
  const baseName = sanitizeBaseName(fileEntry.name) || "archivo";
  const fileName = `${uploadedAt}-${randomUUID().slice(0, 8)}-${baseName}${getExtension(fileEntry)}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  const buffer = Buffer.from(await fileEntry.arrayBuffer());

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), buffer);

  return NextResponse.json({
    fileName,
    folder,
    url: `/uploads/${folder}/${fileName}`,
  });
}
