import assert from "node:assert/strict";
import { test } from "node:test";
import { observeProductImage } from "./vision";

const observation = {
  visibleText: ["HY300", "Proyector"], brand: "Super Vision", model: "HY300", category: "proyector", color: "negro",
  readability: "clear", multipleProducts: false, canReadCode: true,
};

function options(transport: typeof fetch) {
  return {
    apiKey: "synthetic-key", model: "gpt-4.1-mini", transport,
    image: { mimeType: "image/jpeg" as const, bytes: Buffer.from("private-image-pixels") },
  };
}

test("vision sends a private data URL with strict observation schema and no commercial fields", async () => {
  let calls = 0;
  const result = await observeProductImage(options(async (url, init) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.input[0].content[1].type, "input_image");
    assert.match(body.input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
    assert.equal(String(init?.body).includes("private-image-pixels"), false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.properties.productId, undefined);
    assert.equal(body.text.format.schema.properties.price, undefined);
    assert.equal(body.text.format.schema.properties.stock, undefined);
    return Response.json({ status: "completed", usage: { input_tokens: 51, output_tokens: 22 }, output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(observation) }] }] });
  }));
  assert.deepEqual(result.observation, observation);
  assert.deepEqual(result.usage, { inputTokens: 51, outputTokens: 22 });
  assert.equal(calls, 1);
});

test("vision redacts accidental personal data from observable text", async () => {
  const result = await observeProductImage(options(async () => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({
    ...observation, visibleText: ["HY300", "cliente@example.com", "+51 999 888 777"], brand: "cliente@example.com",
  }) }] }] })));
  assert.deepEqual(result.observation.visibleText, ["HY300", "[correo]", "[teléfono o documento]"]);
  assert.equal(result.observation.brand, "[correo]");
});

test("unsupported, empty and oversized images are rejected without a request", async () => {
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; throw new Error("should not fetch"); };
  await assert.rejects(observeProductImage({ ...options(transport), image: { mimeType: "image/svg+xml" as never, bytes: Buffer.from("x") } }), /IMAGE_MIME_UNSUPPORTED/);
  await assert.rejects(observeProductImage({ ...options(transport), image: { mimeType: "image/jpeg", bytes: Buffer.alloc(0) } }), /IMAGE_EMPTY/);
  await assert.rejects(observeProductImage({ ...options(transport), image: { mimeType: "image/jpeg", bytes: Buffer.alloc(10) }, maxImageBytes: 5 }), /IMAGE_TOO_LARGE/);
  assert.equal(calls, 0);
});

test("incomplete, refusal-like and malformed provider outputs cannot become observations", async () => {
  const replies = [
    Response.json({ status: "incomplete", output: [] }),
    Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] }),
    Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "{not json" }] }] }),
    Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ ...observation, productId: "invented" }) }] }] }),
  ];
  for (const reply of replies) {
    await assert.rejects(observeProductImage(options(async () => reply)), /OPENAI_INCOMPLETE|VISUAL_OUTPUT_MISSING|VISUAL_OUTPUT_INVALID/);
  }
});

test("missing credentials and provider failures expose only stable error codes", async () => {
  await assert.rejects(observeProductImage({ ...options(async () => { throw new Error("should not fetch"); }), apiKey: "" }), /OPENAI_NOT_CONFIGURED/);
  await assert.rejects(observeProductImage(options(async () => Response.json({ secret: "do-not-leak" }, { status: 429 }))), error => {
    return error instanceof Error && error.message === "OPENAI_HTTP_429" && !error.message.includes("do-not-leak");
  });
  await assert.rejects(observeProductImage(options(async () => { throw new Error("provider-secret"); })), /OPENAI_UNAVAILABLE/);
});
