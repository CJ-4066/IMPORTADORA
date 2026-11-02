import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { approveDraft, configureConversation, dispatchDraft, emergencyStop, generateDraft, pauseForHuman, saveSettings, settings, workerTick } from "./service";
import { targetKey } from "./policy";

const url = new URL(process.env.DATABASE_URL || "http://invalid");
if (url.hostname !== "127.0.0.1" || url.pathname !== "/rocky_ai_test" || process.env.ROCKY_AI_TEST_DATABASE_URL !== process.env.DATABASE_URL) {
  throw new Error("Integration tests require an explicitly disposable localhost rocky_ai_test database");
}
const originalFetch = global.fetch;
let sends = 0, calls = 0, failDelivery = false;
let duringGeneration: (() => Promise<void>) | null = null;
const greeting = { intent: "greeting", productIds: [], quantity: 1, policyKey: "none", reason: "routine" };
beforeEach(async () => {
  await prisma.rockyAiDraft.deleteMany();
  await prisma.rockyAiConversation.deleteMany();
  await prisma.rockyAiUsage.deleteMany();
  await prisma.rockyAiAudit.deleteMany();
  await prisma.chatContact.deleteMany();
  await prisma.rockyAiSettings.deleteMany();
  await prisma.storeSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: { botMasterSwitch: true } });
  await settings();
  await prisma.rockyAiSettings.update({ where: { id: 1 }, data: { enabled: true, dailyTokens: 1000000 } });
  process.env.OPENAI_API_KEY = "synthetic-not-real";
  process.env.YCLOUD_API_KEY = "synthetic-not-real";
  process.env.YCLOUD_WHATSAPP_FROM = "+15005550006";
  sends = 0; calls = 0; failDelivery = false; duringGeneration = null;
  global.fetch = async (input) => {
    const url = String(input);
    if (url === "https://api.openai.com/v1/responses") {
      calls++;
      if (duringGeneration) { const hook = duringGeneration; duringGeneration = null; await hook(); }
      return Response.json({ status: "completed", usage: { input_tokens: 50, output_tokens: 30 },
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(greeting) }] }] });
    }
    if (url === "https://api.ycloud.com/v2/whatsapp/messages") {
      sends++; if (failDelivery) throw new Error("ambiguous network timeout");
      return Response.json({ id: `provider-${randomUUID()}` });
    }
    throw new Error(`Network denied by test: ${url.split("?")[0]}`);
  };
});
after(async () => { global.fetch = originalFetch; await prisma.$disconnect(); });
async function fixture(mode: "AUTO" | "HYBRID" | "COPILOT" = "COPILOT") {
  const contact = await prisma.chatContact.create({ data: { name: "Cliente de prueba", channel: "WHATSAPP", phone: "+15005550006", externalId: randomUUID() } });
  const c = await prisma.conversation.create({ data: { contactId: contact.id, channel: "WHATSAPP" } });
  await prisma.chatMessage.create({ data: { conversationId: c.id, direction: "INBOUND", senderType: "CUSTOMER", content: "Hola",
    createdAt: new Date(Date.now() - 30000) } });
  await configureConversation("whatsapp", c.id, mode, mode === "COPILOT", "test-admin");
  return { id: targetKey("whatsapp", c.id), externalId: c.id };
}
async function inbound(externalId: string, content = "Hola de nuevo") {
  await prisma.chatMessage.create({ data: { conversationId: externalId, direction: "INBOUND", senderType: "CUSTOMER", content, createdAt: new Date(Date.now() - 1000) } });
}
test("Copilot persists a draft without sending; concurrent approvals and dispatch send only once", async () => {
  const c = await fixture(); const d = await generateDraft(c.id, "test-admin", true);
  assert.ok(d); assert.equal(d.state, "DRAFT"); assert.equal(sends, 0);
  await Promise.allSettled([approveDraft(d.id, d.text, "admin"), approveDraft(d.id, d.text, "admin")]);
  await Promise.all([dispatchDraft(d.id), dispatchDraft(d.id)]);
  assert.equal(sends, 1); assert.equal((await prisma.rockyAiDraft.findUniqueOrThrow({ where: { id: d.id } })).state, "SUBMITTED");
});
test("a new inbound message atomically expires pending approvals", async () => {
  const c = await fixture(); const d = (await generateDraft(c.id, "test-admin", true))!;
  await inbound(c.externalId);
  assert.equal((await prisma.rockyAiDraft.findUniqueOrThrow({ where: { id: d.id } })).state, "EXPIRED");
  await assert.rejects(approveDraft(d.id, d.text, "admin"), /DRAFT_EXPIRED/);
  await dispatchDraft(d.id); assert.equal(sends, 0);
});
test("human takeover after approval invalidates the queue", async () => {
  const c = await fixture(); const d = (await generateDraft(c.id, "test-admin", true))!;
  await approveDraft(d.id, d.text, "admin");
  await pauseForHuman("whatsapp", c.externalId, "seller");
  await dispatchDraft(d.id); assert.equal(sends, 0);
});
test("new inbound during inference cannot publish a stale draft", async () => {
  const c = await fixture(); duringGeneration = () => inbound(c.externalId);
  await assert.rejects(generateDraft(c.id, "admin", true), /CONTEXT_CHANGED/);
  assert.equal(await prisma.rockyAiDraft.count(), 0);
});
test("emergency stop blocks approved messages and generation", async () => {
  const c = await fixture(); const d = (await generateDraft(c.id, "admin", true))!;
  await approveDraft(d.id, d.text, "admin"); await emergencyStop("admin"); await dispatchDraft(d.id);
  assert.equal(sends, 0);
  await assert.rejects(generateDraft(c.id, "admin", true), /DISABLED/);
});
test("ambiguous delivery remains uncertain and is never automatically retried", async () => {
  const c = await fixture(); const d = (await generateDraft(c.id, "admin", true))!;
  await approveDraft(d.id, d.text, "admin"); failDelivery = true;
  await dispatchDraft(d.id); await dispatchDraft(d.id);
  assert.equal(sends, 1);
  assert.equal((await prisma.rockyAiDraft.findUniqueOrThrow({ where: { id: d.id } })).state, "UNCERTAIN");
  assert.equal((await prisma.rockyAiConversation.findUniqueOrThrow({ where: { id: c.id } })).humanControl, true);
});
test("automatic mode queues a fresh safe turn but never replies twice to the same inbound", async () => {
  const c = await fixture("AUTO"); await prisma.rockyAiConversation.update({ where: { id: c.id }, data: { lastTrigger: null } });
  const d = await generateDraft(c.id, "worker"); assert.ok(d); assert.equal(d.state, "QUEUED");
  assert.equal(await generateDraft(c.id, "worker"), null);
  await dispatchDraft(d.id); assert.equal(sends, 1);
});
test("human requests become review drafts and pause autonomy without calling OpenAI", async () => {
  const c = await fixture("AUTO");
  await inbound(c.externalId, "Quiero un asesor");
  const d = await generateDraft(c.id, "admin", true);
  assert.equal(d?.state, "DRAFT"); assert.equal(calls, 0); assert.equal(sends, 0);
  assert.equal((await prisma.rockyAiConversation.findUniqueOrThrow({ where: { id: c.id } })).humanControl, true);
});
test("missing OpenAI credentials permits control and settings but no inference", async () => {
  const c = await fixture(); delete process.env.OPENAI_API_KEY;
  await assert.rejects(generateDraft(c.id, "admin", true), /NOT_CONFIGURED/);
  await workerTick(); assert.equal(calls, 0); assert.equal(sends, 0);
});
test("daily budget is reserved transactionally before requesting OpenAI", async () => {
  const c = await fixture();
  await prisma.rockyAiSettings.update({ where: { id: 1 }, data: { dailyRequests: 1 } });
  await generateDraft(c.id, "admin", true);
  await assert.rejects(generateDraft(c.id, "admin", true), /DAILY_LIMIT/);
  assert.equal(calls, 1);
});
test("manual messages imported outside the UI pause AI through the database guard", async () => {
  const c = await fixture("AUTO");
  const d = (await generateDraft(c.id, "admin", true))!;
  await approveDraft(d.id, d.text, "admin");
  await prisma.chatMessage.create({ data: { conversationId: c.externalId, direction: "OUTBOUND", senderType: "AGENT", content: "Te atiendo yo" } });
  await dispatchDraft(d.id); assert.equal(sends, 0);
  assert.equal((await prisma.rockyAiConversation.findUniqueOrThrow({ where: { id: c.id } })).humanControl, true);
});
test("legacy global stop also stops the new AI module", async () => {
  await prisma.storeSettings.update({ where: { id: 1 }, data: { botMasterSwitch: false } });
  assert.equal((await settings()).enabled, false);
});
test("configuration changes invalidate existing drafts", async () => {
  const c = await fixture(); const d = (await generateDraft(c.id, "admin", true))!;
  const s = await settings();
  await saveSettings({ ...s, dailyRequests: 150 }, "admin");
  await assert.rejects(approveDraft(d.id, d.text, "admin"), /DRAFT_EXPIRED/);
});
test("interrupted deliveries are recovered as uncertain without resending", async () => {
  const c = await fixture(); const d = (await generateDraft(c.id, "admin", true))!;
  await prisma.rockyAiDraft.update({ where: { id: d.id }, data: { state: "SENDING", updatedAt: new Date(Date.now() - 240000) } });
  delete process.env.OPENAI_API_KEY;
  await workerTick();
  assert.equal((await prisma.rockyAiDraft.findUniqueOrThrow({ where: { id: d.id } })).state, "UNCERTAIN");
  assert.equal((await prisma.rockyAiConversation.findUniqueOrThrow({ where: { id: c.id } })).humanControl, true);
  assert.equal(sends, 0);
});
test("a price change after approval prevents an outdated quotation from being sent", async () => {
  const c = await fixture(); const d = (await generateDraft(c.id, "admin", true))!;
  const product = await prisma.product.create({ data: { code: randomUUID(), slug: randomUUID(), name: "Prueba", unitPrice: 20, stockUnits: 10 } });
  const decision = { intent: "product", productIds: [product.id], quantity: 1, policyKey: "none", reason: "routine" };
  await prisma.rockyAiDraft.update({ where: { id: d.id }, data: { decision, evidence: [{ id: product.id, name: product.name, code: product.code, price: 20, stock: 10, wholesalePrice: null, wholesaleMinQty: 3 }] } });
  await approveDraft(d.id, "Prueba: S/ 20.00", "admin");
  await prisma.product.update({ where: { id: product.id }, data: { unitPrice: 25 } });
  await dispatchDraft(d.id);
  assert.equal((await prisma.rockyAiDraft.findUniqueOrThrow({ where: { id: d.id } })).state, "EXPIRED");
  assert.equal(sends, 0);
  await prisma.product.delete({ where: { id: product.id } });
});
