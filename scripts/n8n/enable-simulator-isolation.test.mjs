import assert from "node:assert/strict";
import test from "node:test";

import { enableSimulatorIsolation } from "./enable-simulator-isolation.mjs";

const node = (name, extra = {}) => ({ name, parameters: {}, ...extra });
const connection = (target) => ({ main: [[{ node: target, type: "main", index: 0 }]] });

function fixtures() {
  return [
    {
      name: "01 - Incoming Messages",
      nodes: [
        node("Edit Fields1"), node("Get ManyChat custom fields"), node("Find ManyChat subscriber"),
        node("HTTP Request", { parameters: { bodyParameters: { parameters: [{ name: "manychatSubscriberId", value: "old" }] } } }),
      ],
      connections: { "Edit Fields1": connection("Get ManyChat custom fields") },
    },
    {
      name: "03 - Conversation Router V2 - STAGING",
      nodes: [
        node("Normalize Router Input", { parameters: { jsCode: "const triggerMessageId = 'x'; return [{ json: { receivedAt: typeof source.timestamp === 'string' ? source.timestamp : new Date().toISOString() } }];" } }),
        node("Prepare Ordered Outbound", { parameters: { jsCode: "return [{ json: { timestamp: new Date().toISOString() } }];" } }),
        node("Dispatch via Outbound V2"), node("Router V2 Completed"),
      ],
      connections: { "Prepare Ordered Outbound": connection("Dispatch via Outbound V2") },
    },
    {
      name: "Catálogo automático de proyectores",
      nodes: [node("¿Enviar catálogo?"), node("Enviar PDF por WhatsApp")],
      connections: { "¿Enviar catálogo?": connection("Enviar PDF por WhatsApp") },
    },
  ];
}

test("adds isolated simulator routes without changing the real delivery branch", () => {
  const workflows = enableSimulatorIsolation(fixtures());
  const incoming = workflows[0];
  const router = workflows[1];
  const catalog = workflows[2];

  assert.equal(incoming.connections["¿Es una simulación?"].main[0][0].node, "Continuar sin consultar ManyChat");
  assert.equal(incoming.connections["¿Es una simulación?"].main[1][0].node, "Get ManyChat custom fields");
  assert.equal(incoming.nodes.find((item) => item.name === "Continuar sin consultar ManyChat").type, "n8n-nodes-base.noOp");
  assert.match(router.nodes.find((item) => item.name === "Normalize Router Input").parameters.jsCode, /SIM-CUSTOMER-/);
  assert.equal(router.connections["¿Salida de simulación?"].main[1][0].node, "Dispatch via Outbound V2");
  assert.equal(catalog.connections["¿Es catálogo simulado?"].main[0][0].node, "Registrar catálogo simulado");
  assert.equal(catalog.connections["¿Es catálogo simulado?"].main[1][0].node, "Enviar PDF por WhatsApp");
});

test("refuses to patch the same workflows twice", () => {
  const workflows = enableSimulatorIsolation(fixtures());
  assert.throws(() => enableSimulatorIsolation(workflows), /already contains/);
});
