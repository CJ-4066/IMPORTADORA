import { createHash } from "node:crypto";
import { ycloudMediaKind } from "../ycloud-media";
import { telegramBridgeHeaders, telegramBridgeUrl } from "../telegram-bridge";
import type { AiChannel } from "./policy";

export const MAX_VISUAL_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VISUAL_IMAGE_PIXELS = 24_000_000;

export type InboundImage = {
  bytes: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  byteLength: number;
  contentHash: string;
  width: number;
  height: number;
  source: "whatsapp" | "telegram";
};

export type StoredInboundMedia = {
  channel: AiChannel;
  messageType: string;
  mediaUrl: string | null;
  metadata: unknown;
};

export class InboundMediaError extends Error {
  constructor(readonly code: "UNSUPPORTED_MEDIA" | "UNSUPPORTED_CHANNEL" | "MEDIA_TOO_LARGE" | "INVALID_IMAGE" | "MEDIA_UNAVAILABLE" | "MEDIA_CONFIGURATION") {
    super(code);
    this.name = "InboundMediaError";
  }
}

type ImageType = InboundImage["mimeType"];
type Dimensions = { width: number; height: number };

function numberAt(bytes: Buffer, offset: number, length: number, littleEndian = false) {
  if (offset < 0 || length < 1 || offset + length > bytes.length) return null;
  let value = 0;
  for (let index = 0; index < length; index++) {
    const shift = littleEndian ? index : length - index - 1;
    value += bytes[offset + index]! * 2 ** (shift * 8);
  }
  return value;
}

function jpegDimensions(bytes: Buffer): Dimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++]!;
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = numberAt(bytes, offset, 2);
    if (!length || length < 2 || offset + length > bytes.length) return null;
    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      const height = numberAt(bytes, offset + 3, 2);
      const width = numberAt(bytes, offset + 5, 2);
      return width && height ? { width, height } : null;
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes: Buffer): Dimensions | null {
  if (bytes.length < 30 || bytes.subarray(0, 4).toString() !== "RIFF" || bytes.subarray(8, 12).toString() !== "WEBP") return null;
  const kind = bytes.subarray(12, 16).toString();
  const chunkLength = numberAt(bytes, 16, 4, true);
  const payload = 20;
  const riffLength = numberAt(bytes, 4, 4, true);
  if (riffLength === null || chunkLength === null || riffLength + 8 > bytes.length || payload + chunkLength > bytes.length) return null;
  if (kind === "VP8X") {
    if (chunkLength < 10) return null;
    const width = numberAt(bytes, payload + 4, 3, true);
    const height = numberAt(bytes, payload + 7, 3, true);
    return width === null || height === null ? null : { width: width + 1, height: height + 1 };
  }
  if (kind === "VP8 ") {
    if (chunkLength < 10 || !bytes.subarray(payload + 3, payload + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) return null;
    const width = numberAt(bytes, payload + 6, 2, true);
    const height = numberAt(bytes, payload + 8, 2, true);
    return width === null || height === null ? null : { width: width & 0x3fff, height: height & 0x3fff };
  }
  if (kind === "VP8L" && bytes[payload] === 0x2f) {
    if (chunkLength < 5) return null;
    const packed = numberAt(bytes, payload + 1, 4, true);
    return packed === null ? null : { width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

/** Validates image bytes instead of trusting a provider MIME header. */
export function inspectImage(bytes: Buffer): { mimeType: ImageType; width: number; height: number } | null {
  let mimeType: ImageType | null = null;
  let dimensions: Dimensions | null = null;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    numberAt(bytes, 8, 4) === 13 && bytes.subarray(12, 16).toString() === "IHDR") {
    mimeType = "image/png";
    const width = numberAt(bytes, 16, 4), height = numberAt(bytes, 20, 4);
    dimensions = width && height ? { width, height } : null;
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    mimeType = "image/jpeg";
    dimensions = jpegDimensions(bytes);
  } else if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") {
    mimeType = "image/webp";
    dimensions = webpDimensions(bytes);
  }
  if (!mimeType || !dimensions || !Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height) ||
    dimensions.width < 1 || dimensions.height < 1 || dimensions.width * dimensions.height > MAX_VISUAL_IMAGE_PIXELS) return null;
  return { mimeType, ...dimensions };
}

async function readBoundedBody(response: Response) {
  const declaredLength = response.headers.get("content-length");
  const contentLength = declaredLength === null ? null : Number(declaredLength);
  if (contentLength !== null && Number.isFinite(contentLength) && (contentLength < 1 || contentLength > MAX_VISUAL_IMAGE_BYTES)) {
    await response.body?.cancel();
    throw new InboundMediaError("MEDIA_TOO_LARGE");
  }
  if (!response.body) throw new InboundMediaError("MEDIA_UNAVAILABLE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_VISUAL_IMAGE_BYTES) throw new InboundMediaError("MEDIA_TOO_LARGE");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  if (!total) throw new InboundMediaError("INVALID_IMAGE");
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), total);
}

async function fetchImage(url: string, headers: HeadersInit, transport: typeof fetch) {
  let response: Response;
  try {
    response = await transport(url, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new InboundMediaError("MEDIA_UNAVAILABLE");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new InboundMediaError("MEDIA_UNAVAILABLE");
  }
  return readBoundedBody(response);
}

function telegramFileId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>).telegramFileId;
  return typeof value === "string" && value.length > 0 && value.length <= 500 ? value : null;
}

/**
 * Retrieves only local provider media from backend allowlisted endpoints. It
 * deliberately refuses social attachment URLs until each social provider has a
 * dedicated authenticated downloader; accepting a random HTTPS URL here would
 * make the worker an SSRF primitive.
 */
export async function loadInboundImage(media: StoredInboundMedia, transport: typeof fetch = fetch): Promise<InboundImage> {
  if (media.messageType !== "IMAGE") throw new InboundMediaError("UNSUPPORTED_MEDIA");
  let bytes: Buffer;
  let source: InboundImage["source"];
  if (media.channel === "whatsapp") {
    const kind = ycloudMediaKind(media.mediaUrl);
    if (!kind || !media.mediaUrl) throw new InboundMediaError("UNSUPPORTED_MEDIA");
    const headers = new Headers({ "Accept-Encoding": "identity" });
    if (kind === "api") {
      const apiKey = process.env.YCLOUD_API_KEY?.trim();
      if (!apiKey) throw new InboundMediaError("MEDIA_CONFIGURATION");
      headers.set("X-API-Key", apiKey);
    }
    bytes = await fetchImage(media.mediaUrl, headers, transport);
    source = "whatsapp";
  } else if (media.channel === "telegram") {
    const fileId = telegramFileId(media.metadata);
    if (!fileId) throw new InboundMediaError("UNSUPPORTED_MEDIA");
    try {
      bytes = await fetchImage(telegramBridgeUrl(`media?fileId=${encodeURIComponent(fileId)}`), telegramBridgeHeaders(), transport);
    } catch (error) {
      if (error instanceof InboundMediaError) throw error;
      throw new InboundMediaError("MEDIA_CONFIGURATION");
    }
    source = "telegram";
  } else {
    throw new InboundMediaError("UNSUPPORTED_CHANNEL");
  }
  const image = inspectImage(bytes);
  if (!image) throw new InboundMediaError("INVALID_IMAGE");
  return { bytes, ...image, byteLength: bytes.length, contentHash: createHash("sha256").update(bytes).digest("hex"), source };
}

export function imageDataUrl(image: Pick<InboundImage, "bytes" | "mimeType">) {
  return `data:${image.mimeType};base64,${image.bytes.toString("base64")}`;
}
