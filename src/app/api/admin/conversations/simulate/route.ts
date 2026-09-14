import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { N8nAutomationProvider } from "@/lib/automations/n8n-provider";
import { prisma } from "@/lib/prisma";
import { normalizeWhatsappPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SIMULATOR_WEBHOOK_PATH = "wh-1";

const simulatorInputSchema = z.object({
  content: z.string().trim().min(1).max(1200),
  name: z.string().trim().min(1).max(180).default("Cliente Simulador"),
  phone: z.string().trim().max(32).default("+51 999 888 777"),
  sessionKey: z.string().trim().min(1).max(80).default("default"),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = simulatorInputSchema.parse(await request.json());
    const now = new Date();
    const normalizedPhone = normalizeWhatsappPhone(input.phone);
    const externalId = `SIMULATOR:${input.sessionKey}`;

    const contact = await prisma.chatContact.upsert({
      where: {
        channel_externalId: {
          channel: "WHATSAPP",
          externalId,
        },
      },
      create: {
        channel: "WHATSAPP",
        externalId,
        name: input.name,
        phone: input.phone,
        phoneNormalized: normalizedPhone,
        tags: ["simulador"],
      },
      update: {
        name: input.name,
        phone: input.phone,
        phoneNormalized: normalizedPhone,
      },
    });

    let conversation = await prisma.conversation.findFirst({
      where: {
        channel: "WHATSAPP",
        contactId: contact.id,
        status: { not: "CERRADO" },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          botEnabled: true,
          channel: "WHATSAPP",
          contactId: contact.id,
          status: "AUTOMATICO",
        },
      });
    } else if (!conversation.botEnabled || conversation.status !== "AUTOMATICO") {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          botEnabled: true,
          status: "AUTOMATICO",
        },
      });
    }

    const customerMessage = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        content: input.content,
        direction: "INBOUND",
        externalMessageId: `SIM-CUSTOMER-${randomUUID()}`,
        messageType: "TEXT",
        metadata: {
          phone: input.phone,
          source: "admin-simulator",
        },
        senderType: "CUSTOMER",
        status: "delivered",
        createdAt: now,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: customerMessage.createdAt,
        unreadCount: { increment: 1 },
      },
    });

    const settings = await prisma.storeSettings.findFirst({
      select: { botMasterSwitch: true },
    });
    let automationError: string | null = null;
    let automationExecutionId: string | null = null;
    let automationName: string | null = null;
    let automationTriggered = false;

    if (settings?.botMasterSwitch === false) {
      automationError = "Bot global apagado en configuración.";
    } else {
      try {
        const activeAutomation = await prisma.automation.findFirst({
          where: { channel: "WHATSAPP", status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            versions: {
              where: { status: "PUBLISHED" },
              orderBy: { version: "desc" },
              take: 1,
              select: { id: true },
            },
          },
        });

        const publishedVersion = activeAutomation?.versions[0];
        if (!activeAutomation || !publishedVersion) {
          automationError = "No hay una automatización activa y publicada para WhatsApp.";
        } else {
          automationName = activeAutomation.name;
          const execution = await prisma.automationExecution.create({
            data: {
              automationId: activeAutomation.id,
              automationVersionId: publishedVersion.id,
              conversationId: conversation.id,
              correlationId: `${conversation.id}-${customerMessage.id}`,
              messageId: customerMessage.id,
              status: "RUNNING",
            },
          });

          automationExecutionId = execution.id;
          await N8nAutomationProvider.triggerWebhook(SIMULATOR_WEBHOOK_PATH, {
            channel: "WHATSAPP",
            contactId: contact.id,
            conversationId: conversation.id,
            content: input.content,
            dryRun: true,
            executionId: execution.id,
            externalContactId: externalId,
            messageId: customerMessage.id,
            metadata: {
              dryRun: true,
              name: input.name,
              phone: input.phone,
              phoneNormalized: normalizedPhone,
              sessionKey: input.sessionKey,
              simulation: true,
              source: "admin-simulator",
            },
            name: input.name,
            phone: normalizedPhone || input.phone,
            rawPhone: input.phone,
            simulation: true,
            timestamp: now.toISOString(),
          });
          automationTriggered = true;
        }
      } catch (error) {
        automationError = error instanceof Error
          ? error.message
          : "No se pudo disparar la automatización de n8n.";
      }
    }

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
    });

    return NextResponse.json({
      automationError,
      automationExecutionId,
      automationName,
      automationTriggered,
      conversationId: conversation.id,
      customerMessageId: customerMessage.id,
      messages,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.issues }, { status: 400 });
    }

    console.error("Simulator error:", error);
    return NextResponse.json({ error: "No se pudo simular la conversación." }, { status: 500 });
  }
}
