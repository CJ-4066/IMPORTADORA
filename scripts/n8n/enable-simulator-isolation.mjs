import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const edge = (node, index = 0) => ({ node, type: "main", index });

function ifNode(name, expression, position) {
  return {
    id: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
    name,
    position,
    type: "n8n-nodes-base.if",
    typeVersion: 2.3,
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3 },
        conditions: [{ id: `${name}-condition`, leftValue: expression, rightValue: "", operator: { type: "boolean", operation: "true", singleValue: true } }],
        combinator: "and",
      },
      options: {},
    },
  };
}

function internalRequest(name, jsonBody, position) {
  return {
    id: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
    name,
    position,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.5,
    parameters: {
      method: "POST",
      url: "https://tiendavirtualsuper.com/api/internal/chat/outgoing",
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      sendBody: true,
      specifyBody: "json",
      jsonBody,
      options: { timeout: 30000 },
    },
  };
}

function requireWorkflow(workflows, name) {
  const workflow = workflows.find((candidate) => candidate.name === name);
  if (!workflow) throw new Error(`Workflow not found: ${name}`);
  return workflow;
}

function requireNode(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`Node not found in ${workflow.name}: ${name}`);
  return node;
}

function ensureAbsent(workflow, names) {
  const duplicate = workflow.nodes.find((node) => names.includes(node.name));
  if (duplicate) throw new Error(`${workflow.name} already contains ${duplicate.name}`);
}

function patchIncoming(workflow) {
  const names = ["¿Es una simulación?", "Continuar sin consultar ManyChat"];
  ensureAbsent(workflow, names);
  const edit = requireNode(workflow, "Edit Fields1");
  const incoming = requireNode(workflow, "HTTP Request");
  const getFields = requireNode(workflow, "Get ManyChat custom fields");

  const simulationCheck = ifNode(
    "¿Es una simulación?",
    "={{ String($json.externalContactId || '').startsWith('SIMULATOR:') }}",
    [440, -80],
  );
  const simulationPass = {
    id: "continue-simulator-without-manychat",
    name: "Continuar sin consultar ManyChat",
    position: [700, -80],
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    parameters: { options: {} },
  };
  workflow.nodes.push(simulationCheck, simulationPass);
  workflow.connections[edit.name] = { main: [[edge(simulationCheck.name)]] };
  workflow.connections[simulationCheck.name] = { main: [[edge(simulationPass.name)], [edge(getFields.name)]] };
  workflow.connections[simulationPass.name] = { main: [[edge(incoming.name)]] };

  const subscriber = incoming.parameters.bodyParameters.parameters.find((parameter) => parameter.name === "manychatSubscriberId");
  if (!subscriber) throw new Error("Incoming workflow has no manychatSubscriberId parameter");
  subscriber.value = "={{ String($('Edit Fields1').first().json.externalContactId || '').startsWith('SIMULATOR:') ? '' : String($('Find ManyChat subscriber').first().json.data?.[0]?.id ?? '') }}";
}

function patchRouter(workflow) {
  const names = ["¿Salida de simulación?", "Registrar respuesta simulada"];
  ensureAbsent(workflow, names);
  const normalize = requireNode(workflow, "Normalize Router Input");
  const prepare = requireNode(workflow, "Prepare Ordered Outbound");
  const dispatch = requireNode(workflow, "Dispatch via Outbound V2");
  const completed = requireNode(workflow, "Router V2 Completed");

  normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
    "receivedAt: typeof source.timestamp === 'string' ? source.timestamp : new Date().toISOString()",
    "receivedAt: typeof source.timestamp === 'string' ? source.timestamp : new Date().toISOString(),\n    isSimulation: String(triggerMessageId).startsWith('SIM-CUSTOMER-')",
  );
  prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
    "timestamp: new Date().toISOString()",
    "timestamp: new Date().toISOString(),\n    isSimulation: normalized.isSimulation === true",
  );

  const check = ifNode("¿Salida de simulación?", "={{ $json.isSimulation === true }}", [2740, 280]);
  const record = internalRequest(
    "Registrar respuesta simulada",
    "={{ { agentId: 'router-v2-simulator', content: $json.content, conversationId: $json.conversationId, externalMessageId: 'simulated:' + $json.requestId, mediaUrl: $json.mediaUrl, provider: 'manychat', requestId: $json.requestId, type: String($json.type || 'text').toUpperCase() } }}",
    [3000, 180],
  );
  workflow.nodes.push(check, record);
  workflow.connections[prepare.name] = { main: [[edge(check.name)]] };
  workflow.connections[check.name] = { main: [[edge(record.name)], [edge(dispatch.name)]] };
  workflow.connections[record.name] = { main: [[edge(completed.name)]] };
}

function patchCatalog(workflow) {
  const names = ["¿Es catálogo simulado?", "Registrar catálogo simulado"];
  ensureAbsent(workflow, names);
  const shouldSend = requireNode(workflow, "¿Enviar catálogo?");
  const realSend = requireNode(workflow, "Enviar PDF por WhatsApp");

  const check = ifNode("¿Es catálogo simulado?", "={{ $json.simulation === true }}", [760, -40]);
  const record = internalRequest(
    "Registrar catálogo simulado",
    "={{ { agentId: 'catalog-projectors-simulator', content: $json.content, conversationId: $json.conversationId, externalMessageId: 'simulated:' + $json.requestId, mediaUrl: $json.mediaUrl, provider: 'meta-cloud', requestId: $json.requestId, type: 'DOCUMENT' } }}",
    [1020, -200],
  );
  workflow.nodes.push(check, record);
  workflow.connections[shouldSend.name] = { main: [[edge(check.name)], []] };
  workflow.connections[check.name] = { main: [[edge(record.name)], [edge(realSend.name)]] };
}

export function enableSimulatorIsolation(workflows) {
  patchIncoming(requireWorkflow(workflows, "01 - Incoming Messages"));
  patchRouter(requireWorkflow(workflows, "03 - Conversation Router V2 - STAGING"));
  patchCatalog(requireWorkflow(workflows, "Catálogo automático de proyectores"));
  return workflows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [source, destination] = process.argv.slice(2);
  if (!source || !destination) throw new Error("Usage: node enable-simulator-isolation.mjs workflows.json patched.json");
  const workflows = enableSimulatorIsolation(JSON.parse(readFileSync(source, "utf8")));
  const patchedNames = new Set([
    "01 - Incoming Messages",
    "03 - Conversation Router V2 - STAGING",
    "Catálogo automático de proyectores",
  ]);
  writeFileSync(destination, JSON.stringify(workflows.filter((workflow) => patchedNames.has(workflow.name)), null, 2));
  console.log("Prepared isolated simulator branches for incoming, router and catalog workflows");
}
