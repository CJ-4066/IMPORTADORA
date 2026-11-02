import assert from "node:assert/strict";
import { test } from "node:test";
import { automaticAllowed, currentDraft, decisionSchema, hash, maskPersonalData, needsHuman, renderDecision, settingsSchema, targetKey, type Decision, type Snapshot } from "./policy";
const policies = { hours: "De 8 a 20 horas.", location: "", payment: "", shipping: "", returns: "" };
const product = { id: "p1", code: "HY300", name: "Proyector", price: 100, stock: 20, wholesalePrice: 90, wholesaleMinQty: 3 };
const decision: Decision = { intent: "product", productIds: ["p1"], quantity: 3, policyKey: "none", reason: "routine" };
test("evidence fingerprints survive PostgreSQL JSONB property reordering", () => {
  assert.equal(hash([{ price: 12, id: "p", stock: 2 }]), hash([{ stock: 2, id: "p", price: 12 }]));
});
test("catalog quote uses exact published wholesale thresholds and totals", () => {
  assert.match(renderDecision(decision, [product], policies).text, /S\/ 270.00/);
  assert.match(renderDecision({ ...decision, quantity: 2 }, [product], policies).text, /S\/ 200.00/);
});
test("catalog quotes use stock internally without disclosing its quantity", () => {
  const reply = renderDecision({ ...decision, quantity: 1 }, [product], policies).text;
  assert.ok(!reply.includes("20 unidades"));
  assert.ok(!reply.includes("Disponibilidad consultada"));
  assert.match(reply, /La disponibilidad se confirma al realizar el pedido\./);
});
test("unknown products, insufficient stock and invalid prices cannot be automated", () => {
  for (const products of [[], [{ ...product, stock: 2 }], [{ ...product, price: 0 }]]) {
    assert.equal(renderDecision(decision, products, policies).safe, false);
  }
});
test("empty policies and ambiguous results go to review", () => {
  assert.equal(renderDecision({ ...decision, intent: "policy", policyKey: "shipping" }, [], policies).safe, false);
  assert.equal(renderDecision({ ...decision, reason: "ambiguous" }, [product], policies).safe, false);
});
test("modes distinguish bulk automation from hybrid and never auto-send copilot or off", () => {
  assert.equal(automaticAllowed("AUTO", decision, true), true);
  assert.equal(automaticAllowed("HYBRID", decision, true), false);
  assert.equal(automaticAllowed("HYBRID", { ...decision, quantity: 1 }, true), true);
  for (const mode of ["COPILOT", "OFF"] as const) assert.equal(automaticAllowed(mode, decision, true), false);
  assert.equal(automaticAllowed("AUTO", decision, false), false);
});
test("human requests, complaints and payment confirmation stop autonomous handling", () => {
  for (const text of ["Quiero un asesor", "Quiero reembolso", "ya pagué", "descuento especial"]) assert.equal(needsHuman(text), true);
  assert.equal(needsHuman("tienes HY300 por mayor"), false);
});
test("draft checks reject stale context, control, configuration, expiration and channel ownership", () => {
  const state: Snapshot = { triggerId: "m1", contextHash: "same", history: [], owned: true, canSend: true };
  const draft = { contextHash: "same", controlRevision: 2, settingsRevision: 3, expiresAt: new Date(Date.now() + 60000) };
  assert.equal(currentDraft(draft, state, 2, 3), true);
  for (const change of [{ contextHash: "new-message" }, { owned: false }, { canSend: false }]) assert.equal(currentDraft(draft, { ...state, ...change }, 2, 3), false);
  assert.equal(currentDraft(draft, state, 3, 3), false);
  assert.equal(currentDraft(draft, state, 2, 4), false);
  assert.equal(currentDraft(draft, state, 2, 3, Date.now() + 70000), false);
});
test("personal identifiers are redacted while product codes remain available", () => {
  const safe = maskPersonalData("Escríbeme a cliente@example.com +51 999 888 777 por el HY300");
  assert.ok(!safe.includes("cliente@")); assert.ok(!safe.includes("999")); assert.ok(safe.includes("HY300"));
});
test("different channel identifiers never alias and unsafe settings fail validation", () => {
  assert.notEqual(targetKey("messenger", "123"), targetKey("tiktok", "123"));
  assert.equal(decisionSchema.safeParse({ ...decision, quantity: -1 }).success, false);
  assert.equal(settingsSchema.safeParse({ enabled: true, model: "../../", dailyRequests: 0 }).success, false);
});
