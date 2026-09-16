import assert from 'node:assert/strict';
import test from 'node:test';
import { enableCatalogDocuments } from './enable-catalog-documents.mjs';

function workflows() {
  return enableCatalogDocuments({
    nodes: [{ name: 'Send WhatsApp Message STAGING', parameters: { phoneNumberId: 'test-sender' }, credentials: { whatsAppApi: { id: 'existing' } } }],
    connections: { 'If Claim Success': { main: [[]] }, 'If Retry Success': { main: [[]] } },
  }, {
    nodes: [{ name: 'Enviar enlace por ManyChat' }, { name: 'Registrar catálogo enviado', parameters: {} }],
    connections: { '¿Enviar catálogo?': { main: [[{ node: 'Enviar enlace por ManyChat' }]] } },
  });
}

const evaluate = (expression, input) => new Function('$json', '$', `return (${expression.slice(3, -2)});`)(input, () => ({ first: () => ({ json: input }) }));

test('documents use native WhatsApp document payload and preserve the existing credential', () => {
  const {outbound} = workflows();
  const node = outbound.nodes.find(n => n.name === 'Send PDF Document');
  const body = evaluate(node.parameters.jsonBody, { recipient: '51999999999', content: 'Catálogo', mediaUrl: 'https://example.com/catalog.pdf' });
  assert.equal(body.type, 'document');
  assert.equal(body.document.filename, 'Catalogo-de-proyectores.pdf');
  assert.equal(body.document.link, 'https://example.com/catalog.pdf');
  assert.equal(body.text, undefined);
  assert.equal(node.credentials.whatsAppApi.id, 'existing');
  assert.equal(outbound.connections['Send PDF Document'].main[1][0].node, 'Persist Unknown');
});

test('neither HTTP success without message ID nor provider rejection can mark a PDF sent', () => {
  const {outbound, catalog} = workflows();
  const accepted = outbound.nodes.find(n => n.name === 'Verify PDF Acceptance').parameters.conditions.conditions[0].leftValue;
  for(const response of [{}, {error:{code:131047}}, {messages:[]}, {messages:[{id:'fake'}]}]) assert.equal(evaluate(accepted,response),false);
  assert.equal(evaluate(accepted,{messages:[{id:'wamid.real'}]}),true);
  const recorded = catalog.nodes.find(n => n.name === 'Confirmar envío del PDF').parameters.conditions.conditions[0].leftValue;
  assert.equal(evaluate(recorded,{ok:false,provider:'meta-cloud',messageId:'wamid.real'}),false);
  assert.equal(evaluate(recorded,{ok:true,provider:'manychat',messageId:'manychat:test'}),false);
  assert.equal(evaluate(recorded,{ok:true,provider:'meta-cloud',messageId:'wamid.real'}),true);
  assert.equal(catalog.connections['Enviar PDF por WhatsApp'].main[1][0].node, 'Registrar PDF fallido');
  assert.equal(catalog.connections['Confirmar envío del PDF'].main[1][0].node, 'Registrar PDF fallido');
  const failed = catalog.nodes.find(n => n.name === 'Registrar PDF fallido');
  assert.equal(evaluate(failed.parameters.jsonBody, {requestId:'test'}).status, 'failed');
});
