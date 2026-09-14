const fs = require('fs');
let content = fs.readFileSync('src/app/api/webhook/whatsapp/route.ts', 'utf8');

// Add imports
content = content.replace(
  /import \{ processIncomingMessage \} from "@\/lib\/messages-service";/,
  `import { processIncomingMessage } from "@/lib/messages-service";\nimport { prisma } from "@/lib/prisma";\nimport { N8nAutomationProvider } from "@/lib/automations/n8n-provider";`
);

// Add the automation routing logic right after processIncomingMessage
const triggerLogic = `
    const result = await processIncomingMessage({
      channel: "WHATSAPP",
      content: getMessageContent(message, type),
      externalContactId: from,
      externalMessageId: id,
      metadata: {
        message,
        phoneNumberId,
        source: "meta-whatsapp-cloud-api",
      },
      name: findContactName(contacts, from),
      phone: from,
      timestamp: getMetaTimestamp(getString(message, "timestamp")),
      type: mapMetaMessageType(type),
    });

    results.push(result);

    // ==========================================
    // SAAS INBOUND ROUTING (N8N INTERCEPTION)
    // ==========================================
    if (result.ok && !result.duplicate && result.conversation?.botEnabled) {
      try {
        // Busca si hay una automatización activa para WHATSAPP
        const activeAutomation = await prisma.automation.findFirst({
          where: { channel: "WHATSAPP", status: "ACTIVE" },
          include: { 
            versions: { 
              where: { status: "PUBLISHED" },
              orderBy: { version: "desc" },
              take: 1
            } 
          }
        });

        if (activeAutomation && activeAutomation.versions.length > 0) {
          const publishedVersion = activeAutomation.versions[0];
          
          // Crear un registro de ejecución en estado RUNNING (correlation tracking)
          const execution = await prisma.automationExecution.create({
            data: {
              automationId: activeAutomation.id,
              automationVersionId: publishedVersion.id,
              conversationId: result.conversationId,
              messageId: result.messageId,
              status: "RUNNING",
              correlationId: \`\${result.conversationId}-\${result.messageId}\`
            }
          });

          // Disparar Webhook de n8n con el payload completo + IDs de correlación
          await N8nAutomationProvider.triggerWebhook('wh-1', {
            contactId: result.contactId,
            conversationId: result.conversationId,
            messageId: result.messageId,
            executionId: execution.id,
            content: getMessageContent(message, type),
            phone: from,
            metadata: message
          });
        }
      } catch (routingErr) {
        console.error("SaaS Automation Routing Error:", routingErr);
      }
    }
`;

content = content.replace(
  /const result = await processIncomingMessage\([\s\S]*?results\.push\(result\);/g,
  triggerLogic
);

fs.writeFileSync('src/app/api/webhook/whatsapp/route.ts', content);
