import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const messagesService = readFileSync(
  new URL("./messages-service.ts", import.meta.url),
  "utf8",
);
const inboundRoute = readFileSync(
  new URL("../app/api/internal/chat/incoming/route.ts", import.meta.url),
  "utf8",
);
const whatsapp = readFileSync(new URL("./whatsapp.ts", import.meta.url), "utf8");

test("el envío manual usa n8n y no llama directamente a Meta", () => {
  assert.match(messagesService, /sendN8nOutboundMessage/);
  assert.doesNotMatch(messagesService, /sendWhatsapp(Text|Media)Message/);

  const pendingCreate = messagesService.indexOf('status: "pending"');
  const n8nCall = messagesService.indexOf("const sent = await sendN8nOutboundMessage");
  const sentUpdate = messagesService.indexOf('status: "sent"', n8nCall);
  assert.ok(pendingCreate >= 0 && n8nCall > pendingCreate && sentUpdate > n8nCall);
  assert.match(messagesService, /externalMessageId: sent\.messageId/);
  assert.match(messagesService, /status: "sent"/);
  assert.match(messagesService, /status: "failed"/);
  assert.match(messagesService, /manychatSubscriberId/);
  assert.match(messagesService, /parsed\.type\.toLowerCase\(\)/);
  assert.match(messagesService, /startsWith\("SIMULATOR:"\)/);
});

test("inbound y ManyChat conservan sus puntos de entrada actuales", () => {
  assert.match(inboundRoute, /processIncomingMessage/);
  assert.match(whatsapp, /sendQuotePdfToManychat/);
});

test("precondiciones ManyChat y simulador fallan antes de invocar n8n y quedan fallidas", () => {
  const simulatorGuard = messagesService.indexOf('startsWith("SIMULATOR:")');
  const subscriberGuard = messagesService.indexOf('if (!manychatSubscriberId)');
  const n8nCall = messagesService.indexOf("const sent = await sendN8nOutboundMessage");
  const failedUpdate = messagesService.indexOf('status: "failed"', n8nCall);

  assert.ok(simulatorGuard >= 0 && simulatorGuard < n8nCall);
  assert.ok(subscriberGuard >= 0 && subscriberGuard < n8nCall);
  assert.ok(failedUpdate > n8nCall);
  assert.match(messagesService, /MANYCHAT_SUBSCRIBER_ID_MISSING/);
  assert.match(messagesService, /SIMULATOR_CONTACT/);
});

test("no infiere manychatSubscriberId desde externalContactId", () => {
  assert.match(messagesService, /getManychatSubscriberIdFromMetadata\(parsed\.metadata\)/);
  assert.match(messagesService, /parsed\.manychatSubscriberId \?\? getManychatSubscriberIdFromMetadata/);
});

test("los contactos del simulador nunca se relacionan por un teléfono inferido", () => {
  assert.match(messagesService, /const isSimulator = parsed\.externalContactId\.startsWith\("SIMULATOR:"\)/);
  assert.match(messagesService, /isSimulator \? "" : parsed\.externalContactId/);
  assert.match(messagesService, /if \(!contact && normalizedPhone && !isSimulator\)/);
  assert.match(messagesService, /simulation: isSimulator/);
});
