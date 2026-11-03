import assert from "node:assert/strict";
import { test } from "node:test";
import { generateDecision } from "./provider";
import type { HistoryItem } from "./policy";
const decision = { intent: "product", productIds: ["p1"], quantity: 1, policyKey: "none", reason: "routine" };
function options(transport: typeof fetch) {
  return {
    apiKey: "synthetic-key", model: "gpt-4.1-mini", maxOutputTokens: 700,
    history: [{ id: "m1", role: "user" as const, text: "Precio del HY300 cliente@example.com", at: new Date().toISOString() }] as HistoryItem[],
    policies: { hours: "", shipping: "", location: "", payment: "CUENTA_PRIVADA_DE_PRUEBA 11111111111111111111", returns: "", pricing: "No hay descuentos." },
    search: async () => [{ id: "p1", name: "Proyector HY300", code: "HY300", price: 100, stock: 10, wholesalePrice: null, wholesaleMinQty: 3 }],
    reserve: async () => "reservation", record: async () => {}, transport,
  };
}
test("Responses flow executes a bounded catalog tool and validates final IDs without retaining history", async () => {
  let calls = 0, reservations = 0, records = 0;
  const config = options(async (url, init) => {
    calls++; assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false); assert.equal(body.parallel_tool_calls, false);
    assert.match(String(init?.body), /priceMode BOX/);
    assert.equal(String(init?.body).includes("cliente@example.com"), false);
    assert.equal(String(init?.body).includes("CUENTA_PRIVADA_DE_PRUEBA"), false);
    assert.equal(String(init?.body).includes("11111111111111111111"), false);
    assert.equal(String(init?.body).includes("[instrucciones de pago ocultas]"), true);
    assert.equal(body.input[0].content.includes('"payment":true'), true);
    return Response.json({ status: "completed", usage: { input_tokens: 50, output_tokens: 20 }, output: calls === 1
      ? [{ type: "function_call", name: "search_products", call_id: "c1", arguments: '{"query":"HY300"}' }]
      : [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(decision) }] }] });
  });
  config.history.push({ id: "m2", role: "assistant", text: config.policies.payment, at: new Date().toISOString() });
  config.reserve = async () => { reservations++; return "r"; };
  config.record = async () => { records++; };
  const result = await generateDecision(config);
  assert.equal(result.decision.productIds[0], "p1"); assert.equal(calls, 2); assert.equal(reservations, 2); assert.equal(records, 2);
});
test("unverified product IDs are rejected, even in schema-valid output", async () => {
  await assert.rejects(generateDecision(options(async () => Response.json({ status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(decision) }] }] }))), /UNVERIFIED_PRODUCT/);
});
test("refusal, incomplete output and provider failure never produce sendable text", async () => {
  for (const response of [
    Response.json({ status: "incomplete", output: [] }),
    Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] }),
    Response.json({ secret: "do not leak" }, { status: 429 }),
  ]) await assert.rejects(generateDecision(options(async () => response)), error => error instanceof Error && !error.message.includes("do not leak"));
});
test("missing API key causes no request or budget reservation", async () => {
  const config = { ...options(async () => { throw new Error("should not fetch"); }), apiKey: "" };
  await assert.rejects(generateDecision(config), /OPENAI_NOT_CONFIGURED/);
});
test("quota exhaustion prevents the network request", async () => {
  const config = options(async () => { throw new Error("should not fetch"); });
  config.reserve = async () => { throw new Error("DAILY_LIMIT"); };
  await assert.rejects(generateDecision(config), /DAILY_LIMIT/);
});
test("tool loops are capped and no unknown tool executes", async () => {
  let calls = 0;
  await assert.rejects(generateDecision(options(async () => {
    calls++;
    return Response.json({ status: "completed", output: [{ type: "function_call", name: "search_products", call_id: "c", arguments: '{"query":"HY300"}' }] });
  })), /INVALID_TOOL/);
  assert.equal(calls, 3);
  await assert.rejects(generateDecision(options(async () => Response.json({ status: "completed",
    output: [{ type: "function_call", name: "delete_stock", call_id: "c", arguments: "{}" }] }))), /INVALID_TOOL/);
});
