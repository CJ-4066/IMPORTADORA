import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { answerShopAssistant } from "@/lib/shop-assistant";
import { normalizeWhatsappPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

const simulatorInputSchema = z.object({
  content: z.string().trim().min(1).max(1200),
  name: z.string().trim().min(1).max(180).default("Cliente Simulador"),
  phone: z.string().trim().max(32).default("+51 999 888 777"),
  sessionKey: z.string().trim().min(1).max(80).default("default"),
});

function toAssistantHistory(
  messages: Array<{ content: string; senderType: string }>,
) {
  return messages
    .map((message) => {
      if (message.senderType === "CUSTOMER") {
        return { role: "user" as const, text: message.content };
      }

      if (message.senderType === "BOT" || message.senderType === "AGENT") {
        return { role: "assistant" as const, text: message.content };
      }

      return null;
    })
    .filter((message): message is { role: "assistant" | "user"; text: string } => Boolean(message))
    .slice(-6);
}

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
    let botError: string | null = null;

    if (settings?.botMasterSwitch !== false) {
      try {
        const historyRows = await prisma.chatMessage.findMany({
          where: {
            conversationId: conversation.id,
            id: { not: customerMessage.id },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            content: true,
            senderType: true,
          },
        });
        const history = toAssistantHistory(historyRows.reverse());
        const reply = await answerShopAssistant({
          message: input.content,
          recentMessages: history,
        });
        const text = reply.text.trim() || "No encontré una respuesta para esa consulta.";
        const botMessage = await prisma.chatMessage.create({
          data: {
            conversationId: conversation.id,
            content: text,
            direction: "OUTBOUND",
            externalMessageId: `SIM-BOT-${randomUUID()}`,
            messageType: "TEXT",
            metadata: {
              productIds: reply.products?.map((product) => product.id) ?? [],
              productsCount: reply.products?.length ?? 0,
              source: "admin-simulator",
            },
            senderType: "BOT",
            status: "sent",
            createdAt: new Date(),
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: botMessage.createdAt },
        });
      } catch (error) {
        botError = error instanceof Error ? error.message : "No se pudo generar respuesta del bot.";
      }
    }

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
    });

    return NextResponse.json({
      botError,
      botSkipped: settings?.botMasterSwitch === false,
      conversationId: conversation.id,
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
