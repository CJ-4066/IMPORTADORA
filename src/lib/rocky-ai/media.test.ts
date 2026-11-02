import assert from "node:assert/strict";
import { test } from "node:test";
import { InboundMediaError, MAX_VISUAL_IMAGE_BYTES, inspectImage, loadInboundImage } from "./media";

function png(width = 1, height = 1) {
  const image = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(image, 0);
  image.writeUInt32BE(13, 8);
  Buffer.from("IHDR").copy(image, 12);
  image.writeUInt32BE(width, 16);
  image.writeUInt32BE(height, 20);
  return image;
}

test("inspectImage accepts only bounded images with a real image signature and dimensions", () => {
  assert.deepEqual(inspectImage(png(12, 34)), { mimeType: "image/png", width: 12, height: 34 });
  assert.equal(inspectImage(Buffer.from("not an image")), null);
  assert.equal(inspectImage(png(10_000, 10_000)), null);
  const invalidPng = png(); Buffer.from("NOPE").copy(invalidPng, 12);
  assert.equal(inspectImage(invalidPng), null);
});

test("whatsapp loader uses only the known YCloud host, validates bytes and never follows redirects", async () => {
  const image = png();
  let request: RequestInit | undefined;
  const loaded = await loadInboundImage({ channel: "whatsapp", messageType: "IMAGE", metadata: null,
    mediaUrl: "https://static-internal.ycloud.com/yunpian/attila/inbox/message/photo.png" }, async (_url, init) => {
    request = init; return new Response(image, { headers: { "Content-Type": "image/png", "Content-Length": String(image.length) } });
  });
  assert.equal(loaded.mimeType, "image/png");
  assert.equal(loaded.source, "whatsapp");
  assert.equal(request?.redirect, "error");
  await assert.rejects(loadInboundImage({ channel: "whatsapp", messageType: "IMAGE", metadata: null, mediaUrl: "https://example.com/image.png" }),
    (error: unknown) => error instanceof InboundMediaError && error.code === "UNSUPPORTED_MEDIA");
});

test("loader stops oversized and disguised provider payloads before any visual request", async () => {
  const image = png();
  await assert.rejects(loadInboundImage({ channel: "whatsapp", messageType: "IMAGE", metadata: null,
    mediaUrl: "https://static-internal.ycloud.com/yunpian/attila/inbox/message/large.png" }, async () =>
    new Response(image, { headers: { "Content-Length": String(MAX_VISUAL_IMAGE_BYTES + 1) } })),
  (error: unknown) => error instanceof InboundMediaError && error.code === "MEDIA_TOO_LARGE");
  await assert.rejects(loadInboundImage({ channel: "whatsapp", messageType: "IMAGE", metadata: null,
    mediaUrl: "https://static-internal.ycloud.com/yunpian/attila/inbox/message/text.png" }, async () => new Response("not an image")),
  (error: unknown) => error instanceof InboundMediaError && error.code === "INVALID_IMAGE");
});

test("social attachments are deliberately not fetched as arbitrary URLs", async () => {
  await assert.rejects(loadInboundImage({ channel: "messenger", messageType: "IMAGE", metadata: null, mediaUrl: "https://example.com/photo.png" }),
    (error: unknown) => error instanceof InboundMediaError && error.code === "UNSUPPORTED_CHANNEL");
});
