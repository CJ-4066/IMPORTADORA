import assert from "node:assert/strict";
import { test } from "node:test";
import { N8nOutboundError } from "./n8n-outbound";
import {
  getManychatSubscriberIdFromMetadata,
  incomingMessageSchema,
  requireRealManychatSubscriber,
} from "./messages-service";

test("acepta únicamente el subscriber ID explícito del contacto real", () => {
  assert.equal(requireRealManychatSubscriber({
    externalId: "external-contact-1",
    manychatSubscriberId: " 910854597 ",
  }), "910854597");
});

test("subscriber ID faltante devuelve código claro antes del envío", () => {
  assert.throws(
    () => requireRealManychatSubscriber({ externalId: "external-contact-1", manychatSubscriberId: null }),
    (error: unknown) => error instanceof N8nOutboundError
      && error.code === "MANYCHAT_SUBSCRIBER_ID_MISSING"
      && error.statusCode === 422,
  );
});

test("bloquea contactos de simulador aunque tengan subscriber ID", () => {
  assert.throws(
    () => requireRealManychatSubscriber({ externalId: "SIMULATOR:test", manychatSubscriberId: "910854597" }),
    (error: unknown) => error instanceof N8nOutboundError
      && error.code === "SIMULATOR_CONTACT"
      && error.statusCode === 400,
  );
});

test("acepta subscriber ID explícito desde metadata sin usar externalContactId", () => {
  assert.equal(getManychatSubscriberIdFromMetadata({ subscriber_id: 910854597 }), "910854597");
  assert.equal(getManychatSubscriberIdFromMetadata({ externalContactId: "910854597" }), null);
});

test("un lookup ManyChat sin resultado no rechaza el mensaje entrante", () => {
  const parsed = incomingMessageSchema.parse({
    channel: "WHATSAPP",
    externalContactId: "51967426958",
    manychatSubscriberId: "",
    name: "Cliente WhatsApp",
    externalMessageId: "wamid.test",
    content: "hola",
    timestamp: "2026-09-16T01:00:00.000Z",
  });

  assert.equal(parsed.manychatSubscriberId, undefined);
});
