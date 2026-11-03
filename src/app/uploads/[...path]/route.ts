import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { parseHttpByteRange } from "@/lib/http-byte-range";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UPLOAD_ROOT = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "public",
  "uploads",
);

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".3gp": "video/3gpp",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".amr": "audio/amr",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

// Product pictures are mirrored locally during the ERP sync. The runtime
// filesystem is not durable on every deployment, though, so an older local
// URL can outlive its mirrored file. Only proxy the trusted original image
// hosts configured for the storefront; this must never become an open proxy
// based on a database value.
const PRODUCT_IMAGE_SOURCE_HOSTS = new Set([
  "images.unsplash.com",
  "original.negocioserp.com",
]);

function safeJoinUploadPath(parts: string[]) {
  if (parts.some(part => part === "." || part === ".." || part.includes("\\"))) return null;
  const normalizedParts = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part !== "." && part !== "..");

  const resolvedPath = path.resolve(
    /* turbopackIgnore: true */ UPLOAD_ROOT,
    ...normalizedParts,
  );

  if (!resolvedPath.startsWith(`${UPLOAD_ROOT}${path.sep}`) && resolvedPath !== UPLOAD_ROOT) {
    return null;
  }

  return resolvedPath;
}

function getContentType(filePath: string) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function getDecodedRequestPath(request: Request) {
  const pathname = new URL(request.url).pathname;

  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function getTrustedProductImageSource(value: string | null | undefined) {
  const source = value?.trim();

  if (!source) {
    return null;
  }

  try {
    const url = new URL(source);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !PRODUCT_IMAGE_SOURCE_HOSTS.has(url.hostname)
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function isImageContentType(value: string | null) {
  return value?.split(";", 1)[0]?.trim().toLowerCase().startsWith("image/") ?? false;
}

function copySourceImageHeaders(response: Response) {
  const headers = new Headers({
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
    "X-Content-Type-Options": "nosniff",
  });
  const etag = response.headers.get("etag");
  const lastModified = response.headers.get("last-modified");

  if (etag) {
    headers.set("ETag", etag);
  }

  if (lastModified) {
    headers.set("Last-Modified", lastModified);
  }

  return headers;
}

async function getMissingProductImageResponse(request: Request, uploadPath: string[]) {
  if (uploadPath[0] !== "products") {
    return null;
  }

  const requestedPath = getDecodedRequestPath(request);
  let product: { sourceImageUrl: string | null } | null = null;

  try {
    product = await prisma.product.findFirst({
      where: {
        isVisible: true,
        OR: [
          { localImageUrl: requestedPath },
          { imageUrl: requestedPath },
          { media: { some: { type: "IMAGE", url: requestedPath } } },
        ],
      },
      select: { sourceImageUrl: true },
    });
  } catch {
    // A database outage must retain the normal 404 behavior for missing files.
    return null;
  }

  const sourceUrl = getTrustedProductImageSource(product?.sourceImageUrl);

  if (!sourceUrl) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const sourceResponse = await fetch(sourceUrl, {
      cache: "no-store",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": "ImportadoraStorefrontImageFallback/1.0",
      },
      method: request.method === "HEAD" ? "HEAD" : "GET",
      signal: controller.signal,
    });

    if (!sourceResponse.ok || !isImageContentType(sourceResponse.headers.get("content-type"))) {
      return null;
    }

    return new Response(request.method === "HEAD" ? null : sourceResponse.body, {
      headers: copySourceImageHeaders(sourceResponse),
      status: 200,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function readUploadFile(filePath: string, requestHeaders?: Headers) {
  const fileStats = await stat(/* turbopackIgnore: true */ filePath);

  if (!fileStats.isFile()) {
    return null;
  }

  const etag = `W/"${fileStats.size.toString(16)}-${fileStats.mtimeMs.toString(16)}"`;
  const lastModified = fileStats.mtime.toUTCString();

  if (requestHeaders) {
    const ifNoneMatch = requestHeaders.get("if-none-match");
    const ifModifiedSince = requestHeaders.get("if-modified-since");

    if (ifNoneMatch === etag || (ifModifiedSince && new Date(ifModifiedSince) >= fileStats.mtime)) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Last-Modified": lastModified,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  const headers = new Headers();
  headers.set("Content-Type", getContentType(filePath));
  headers.set("Content-Length", String(fileStats.size));
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", etag);
  headers.set("Last-Modified", lastModified);
  headers.set("Accept-Ranges", "bytes");
  headers.set("X-Content-Type-Options", "nosniff");

  const ifRange = requestHeaders?.get("if-range");
  const range = parseHttpByteRange(!ifRange || ifRange === etag || ifRange === lastModified ? requestHeaders?.get("range") ?? null : null, fileStats.size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${fileStats.size}` } });
  if (range) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${fileStats.size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
  }

  const stream = Readable.toWeb(createReadStream(filePath, range ?? undefined)) as ReadableStream;

  return new Response(stream, {
    status: range ? 206 : 200,
    headers,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: uploadPath } = await params;
  const filePath = safeJoinUploadPath(uploadPath);

  if (!filePath) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const response = await readUploadFile(filePath, request.headers);

    if (response) {
      return response;
    }
  } catch {
    // Fall through to the ERP source for a product image whose local mirror
    // was lost during a deployment.
  }

  const fallback = await getMissingProductImageResponse(request, uploadPath);
  return fallback ?? new Response("Not found", { status: 404 });
}

export async function HEAD(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: uploadPath } = await params;
  const filePath = safeJoinUploadPath(uploadPath);

  if (!filePath) {
    return new Response(null, { status: 404 });
  }

  try {
    const fileStats = await stat(/* turbopackIgnore: true */ filePath);

    if (fileStats.isFile()) {
      const headers = new Headers();
      headers.set("Content-Type", getContentType(filePath));
      headers.set("Content-Length", String(fileStats.size));
      headers.set("Cache-Control", "public, max-age=15552000, immutable");
      headers.set("Accept-Ranges", "bytes");

      return new Response(null, {
        status: 200,
        headers,
      });
    }
  } catch {
    // Fall through to the ERP source for a product image whose local mirror
    // was lost during a deployment.
  }

  const fallback = await getMissingProductImageResponse(_request, uploadPath);
  return fallback ?? new Response(null, { status: 404 });
}
