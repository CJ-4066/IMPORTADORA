import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const edge = (node) => ({ node, type: 'main', index: 0 });
const condition = (name, expression, position) => ({
  id: name, name, position, type: 'n8n-nodes-base.if', typeVersion: 2.3,
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
      conditions: [{ id: name, leftValue: expression, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
      combinator: 'and',
    }, options: {},
  },
});

export function enableCatalogDocuments(outbound, catalog) {
  const sender = outbound.nodes.find(n => n.name === 'Send WhatsApp Message STAGING');
  if (!sender?.credentials?.whatsAppApi || !sender.parameters.phoneNumberId) throw new Error('Verified existing WhatsApp sender required');
  const names = ['Route Catalog Document', 'Send PDF Document', 'Verify PDF Acceptance'];
  if(outbound.nodes.some(n => names.includes(n.name))) throw new Error('Document routing already present');

  // Keep the existing idempotency claim, retry and failure paths.
  for (const name of ['If Claim Success', 'If Retry Success']) {
    outbound.connections[name].main[0] = [edge('Route Catalog Document')];
  }
  outbound.nodes.push(condition('Route Catalog Document', "={{ String($('Normalize Outbound V3').first().json.type).toLowerCase() === 'document' }}", [1260, 620]));
  outbound.nodes.push({
    id: 'send-catalog-pdf-document', name: 'Send PDF Document',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5, position: [1510, 620],
    onError: 'continueErrorOutput',
    credentials: structuredClone(sender.credentials),
    parameters: {
      method: 'POST', url: `https://graph.facebook.com/v22.0/${sender.parameters.phoneNumberId}/messages`,
      authentication: 'predefinedCredentialType', nodeCredentialType: 'whatsAppApi',
      sendBody: true, specifyBody: 'json',
      jsonBody: "={{ { messaging_product: 'whatsapp', recipient_type: 'individual', to: $('Normalize Outbound V3').first().json.recipient, type: 'document', document: { link: $('Normalize Outbound V3').first().json.mediaUrl, filename: 'Catalogo-de-proyectores.pdf', caption: $('Normalize Outbound V3').first().json.content } } }}",
      options: { timeout: 60000 },
    },
  });
  outbound.nodes.push(condition('Verify PDF Acceptance', "={{ !$json.error && typeof $json.messages?.[0]?.id === 'string' && $json.messages[0].id.startsWith('wamid.') }}", [1770, 620]));
  outbound.connections['Route Catalog Document'] = { main: [[edge('Send PDF Document')], [edge('Route Delivery Provider')]] };
  outbound.connections['Send PDF Document'] = { main: [[edge('Verify PDF Acceptance')], [edge('Persist Unknown')]] };
  outbound.connections['Verify PDF Acceptance'] = { main: [[edge('Persist Sent')], [edge('Persist Unknown')]] };

  // A successful HTTP response alone is not proof of acceptance by the sender.
  const sendName = 'Enviar enlace por ManyChat';
  const send = catalog.nodes.find(n => n.name === sendName);
  const record = catalog.nodes.find(n => n.name === 'Registrar catálogo enviado');
  if(!send || !record) throw new Error('Unexpected catalog workflow');
  send.name = 'Enviar PDF por WhatsApp';
  for(const connection of Object.values(catalog.connections)) for(const output of connection.main ?? []) for(const e of output) if(e.node === sendName) e.node = send.name;
  delete catalog.connections[sendName];
  catalog.nodes.push(condition('Confirmar envío del PDF', "={{ $json.ok === true && $json.provider === 'meta-cloud' && typeof $json.messageId === 'string' && $json.messageId.startsWith('wamid.') }}", [1010, -80]));
  catalog.connections[send.name] = { main: [[edge('Confirmar envío del PDF')]] };
  catalog.connections['Confirmar envío del PDF'] = { main: [[edge(record.name)], []] };
  record.position = [1250, -80];
  record.parameters.jsonBody = "={{ { agentId: 'catalog-projectors-bot', content: $('Generar catálogo PDF').first().json.content, conversationId: $('Generar catálogo PDF').first().json.conversationId, externalMessageId: $json.messageId, mediaUrl: $('Generar catálogo PDF').first().json.mediaUrl, provider: 'meta-cloud', requestId: $('Generar catálogo PDF').first().json.requestId, type: 'DOCUMENT' } }}";
  return { outbound, catalog };
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [outboundFile, catalogFile, destination] = process.argv.slice(2);
  if(!destination) throw new Error('Usage: node enable-catalog-documents.mjs outbound.json catalog.json existing-output-directory');
  const outbound = JSON.parse(readFileSync(outboundFile, 'utf8'))[0];
  const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'))[0];
  enableCatalogDocuments(outbound, catalog);
  for(const workflow of [outbound, catalog]) writeFileSync(`${destination}/${workflow.id}.json`, JSON.stringify([workflow], null, 2));
  console.log('Prepared document routing with existing sender and credentials');
}
