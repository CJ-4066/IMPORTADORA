import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SUPER_BOT_SIMULATOR_MODEL,
  generateSuperBotSimulatorReply,
} from "./super-bot-simulator-ai";
import type { ShopAssistantReply } from "./shop-assistant-types";

const verifiedReply: ShopAssistantReply = {
  text: "El parlante JBL GO 4 cuesta S/ 199.00 y está disponible.",
  products: [{
    id: "product-1",
    slug: "jbl-go-4",
    code: "JBL-GO4",
    name: "Parlante JBL GO 4",
    description: "Parlante Bluetooth portátil.",
    brand: "JBL",
    category: "Parlantes",
    imageUrl: null,
    imageAlt: null,
    unitPrice: "S/ 199.00",
    unitPriceValue: 199,
    wholesalePrice: null,
    wholesalePriceValue: null,
    wholesaleMinQty: 1,
    availabilityLabel: "Disponible",
    stockUnits: 3,
    unitsPerBox: null,
  }],
};

const getVerifiedReply = async () => verifiedReply;

function completedResponse(reply = "Respuesta de prueba") {
  return {
    status: "completed",
    output_text: JSON.stringify({ reply }),
  };
}

test("does not call OpenAI when simulator AI is disabled", async () => {
  let calls = 0;
  const result = await generateSuperBotSimulatorReply(
    { message: "Busco un parlante JBL" },
    {
      enabled: false,
      getVerifiedReply,
      fetchImpl: (async () => {
        calls += 1;
        return Response.json(completedResponse());
      }) as typeof fetch,
    },
  );

  assert.equal(calls, 0);
  assert.equal(result.provider, "verified");
  assert.equal(result.fallbackReason, "disabled");
  assert.equal(result.text, verifiedReply.text);
});

test("keeps the simulator on verified data when the OpenAI key is absent", async () => {
  let calls = 0;
  const result = await generateSuperBotSimulatorReply(
    { message: "Busco un parlante JBL" },
    {
      enabled: true,
      apiKey: "",
      getVerifiedReply,
      fetchImpl: (async () => {
        calls += 1;
        return Response.json(completedResponse());
      }) as typeof fetch,
    },
  );

  assert.equal(calls, 0);
  assert.equal(result.provider, "verified");
  assert.equal(result.model, DEFAULT_SUPER_BOT_SIMULATOR_MODEL);
  assert.equal(result.fallbackReason, "not_configured");
});

test("uses gpt-6.1-sol through Responses with a verified catalog context", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const result = await generateSuperBotSimulatorReply(
    { message: "Busco un parlante JBL", recentMessages: [{ role: "user", text: "Hola" }] },
    {
      enabled: true,
      apiKey: "test-key",
      getVerifiedReply,
      fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
        requestUrl = String(url);
        requestInit = init;
        return Response.json(completedResponse("Claro, el JBL GO 4 está disponible."));
      }) as typeof fetch,
    },
  );

  assert.equal(result.provider, "openai");
  assert.equal(result.model, DEFAULT_SUPER_BOT_SIMULATOR_MODEL);
  assert.equal(result.text, "Claro, el JBL GO 4 está disponible.");
  assert.equal(requestUrl, "https://api.openai.com/v1/responses");
  assert.equal(requestInit?.method, "POST");
  assert.equal(new Headers(requestInit?.headers).get("Authorization"), "Bearer test-key");

  const body = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
  assert.equal(body.model, "gpt-6.1-sol");
  assert.equal(body.store, false);
  assert.deepEqual(body.reasoning, { effort: "low" });
  assert.equal("temperature" in body, false);
  assert.equal("top_p" in body, false);
  assert.equal((body.text as { format: { type: string } }).format.type, "json_schema");
  assert.doesNotMatch(String(body.input), /stockUnits/);
  assert.match(String(body.input), /JBL-GO4/);
});

test("accepts typed output messages from Responses", async () => {
  const result = await generateSuperBotSimulatorReply(
    { message: "Busco un parlante JBL" },
    {
      enabled: true,
      apiKey: "test-key",
      getVerifiedReply,
      fetchImpl: (async () => Response.json({
        status: "completed",
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ reply: "Respuesta tipada" }) }] }],
      })) as typeof fetch,
    },
  );

  assert.equal(result.provider, "openai");
  assert.equal(result.text, "Respuesta tipada");
});

test("uses the verified reply when the provider fails without exposing provider details", async () => {
  const result = await generateSuperBotSimulatorReply(
    { message: "Busco un parlante JBL" },
    {
      enabled: true,
      apiKey: "test-key",
      getVerifiedReply,
      fetchImpl: (async () => new Response("secret provider details", { status: 429 })) as typeof fetch,
    },
  );

  assert.equal(result.provider, "verified");
  assert.equal(result.fallbackReason, "provider_rejected");
  assert.equal(result.text, verifiedReply.text);
  assert.doesNotMatch(result.text, /secret/);
});

test("does not ask the model to answer when the catalog has no verified answer", async () => {
  let calls = 0;
  const result = await generateSuperBotSimulatorReply(
    { message: "Algo inexistente" },
    {
      enabled: true,
      apiKey: "test-key",
      getVerifiedReply: async () => ({ text: "" }),
      fetchImpl: (async () => {
        calls += 1;
        return Response.json(completedResponse());
      }) as typeof fetch,
    },
  );

  assert.equal(calls, 0);
  assert.equal(result.provider, "verified");
  assert.equal(result.fallbackReason, "no_verified_answer");
  assert.match(result.text, /asesor/);
});
