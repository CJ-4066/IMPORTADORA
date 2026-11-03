import assert from "node:assert/strict";
import test from "node:test";
import { getOptimizedImageUrl, getVersionedUploadUrl } from "./media-url";

test("versiona el caché del optimizador sin alterar la URL fuente local", () => {
  assert.equal(
    getOptimizedImageUrl("/uploads/products/televisor.webp", 384),
    "/_next/image?url=%2Fuploads%2Fproducts%2Ftelevisor.webp&w=384&q=75&assetv=20261103",
  );
});

test("versiona las rutas directas de uploads y conserva las externas", () => {
  assert.equal(
    getVersionedUploadUrl("/uploads/hero/banner.webp"),
    "/uploads/hero/banner.webp?assetv=20261103",
  );
  assert.equal(getVersionedUploadUrl("https://example.com/banner.webp"), "https://example.com/banner.webp");
});
