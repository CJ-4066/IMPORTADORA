import { prisma } from "../prisma";
import { socialConversation, socialRequest, socialReplyInbox, type SocialChannel, type SocialMessage, type SocialPage } from "../social-inbox";
import { messengerControl } from "../messenger-control";
import { controlTelegram } from "../telegram-messages";
import { telegramCommand, telegramReplyWindow } from "../telegram-bridge";
import { telegramMessageKey } from "../telegram-events";
import { normalizeYCloudPhone, sendYCloudOutboundMessage } from "../ycloud-outbound";
import { hash, type AiChannel, type HistoryItem, type Snapshot } from "./policy";

export const isLocal = (channel: AiChannel) => channel === "whatsapp" || channel === "telegram";
export async function snapshot(channel: AiChannel, externalId: string): Promise<Snapshot> {
  let history: HistoryItem[], owned = false, canSend = false, control: unknown;
  if (isLocal(channel)) {
    const c = await prisma.conversation.findUniqueOrThrow({ where: { id: externalId }, include: {
      contact: true, messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30 },
    } });
    if (c.channel.toLowerCase() !== channel || c.contact.externalId?.startsWith("SIMULATOR:")) throw new Error("INVALID_CONVERSATION");
    history = c.messages.filter(m => !["cancelled", "failed"].includes(m.status ?? "")).reverse()
      .map(m => ({ id: m.id, role: m.senderType === "CUSTOMER" ? "user" : "assistant", text: m.content, at: m.createdAt.toISOString(), attachment: m.messageType !== "TEXT" }));
    owned = !c.botEnabled;
    control = [c.automationRevision, c.telegramRevision, c.botEnabled, c.status, c.assignedUserId];
    const lastInbound = history.filter(m => m.role === "user").at(-1);
    // Text-only automation never opens a new messaging session.
    canSend = channel === "telegram" ? telegramReplyWindow(c.telegramLastInboundAt) :
      Boolean(lastInbound && Date.now() - Date.parse(lastInbound.at) < 86400000);
  } else {
    const { conversation, inbox } = await socialConversation(externalId, channel as SocialChannel);
    const page = await socialRequest<SocialPage<SocialMessage>>(`/conversations/${externalId}/messages?perPage=30`);
    history = page.data.filter(m => m.contactInboxId === inbox.id && !m.deletedAt && !m.sendError)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id, undefined, { numeric: true }))
      .map(m => ({ id: m.id, role: m.messageType === "incoming" ? "user" : "assistant", text: m.text || "", at: m.createdAt, attachment: Boolean(m.attachments?.length) }));
    owned = !conversation.botEnabled;
    control = [conversation.botEnabled, inbox.id];
    if (channel === "messenger") {
      if (!process.env.MESSENGER_CONTROL_TOKEN) owned = false;
      else {
        const state = await messengerControl(externalId);
        owned = owned && state.owner === "store" && state.resumeAt === null && !state.error;
        control = [control, state.owner, state.mode, state.resumeAt, state.resumeTarget];
      }
    }
    const incoming = inbox.lastIncomingMessageAt;
    canSend = Boolean(incoming && Date.now() - Date.parse(incoming) < 86400000);
  }
  const triggerId = history.filter(m => m.role === "user").at(-1)?.id ?? "";
  return { history, triggerId, owned, canSend, contextHash: hash([control, history]),
    reason: !owned ? "Otro bot o servicio controla esta conversación." : !canSend ? "Espera un nuevo mensaje del cliente para responder." : undefined };
}

export async function claimChannel(channel: AiChannel, externalId: string) {
  if (isLocal(channel)) {
    const c = await prisma.conversation.findUniqueOrThrow({ where: { id: externalId } });
    if (c.channel.toLowerCase() !== channel) throw new Error("INVALID_CONVERSATION");
    let telegramRevision: number | undefined;
    if (channel === "telegram") telegramRevision = (await controlTelegram(c, false)).revision;
    await prisma.conversation.update({ where: { id: externalId }, data: { botEnabled: false, ...(telegramRevision === undefined ? {} : { telegramRevision }) } });
  } else {
    await socialConversation(externalId, channel as SocialChannel);
    if (channel === "messenger") {
      if (!process.env.MESSENGER_CONTROL_TOKEN) throw new Error("MESSENGER_CONTROL_REQUIRED");
      await messengerControl(externalId, { action: "manual", minutes: 0, actor: "rocky-ai" });
    }
    await socialRequest(`/conversations/${externalId}/disable-bot`, {});
  }
  const state = await snapshot(channel, externalId);
  if (!state.owned) throw new Error("CHANNEL_NOT_OWNED");
  return state;
}

/** Called ONLY after a durable SENDING claim. An ambiguous outcome is never retried. */
export async function deliver(channel: AiChannel, externalId: string, text: string, draftId: string, actor: string | null) {
  if (!isLocal(channel)) {
    const inbox = await socialReplyInbox(channel as SocialChannel, externalId);
    const message = await socialRequest<SocialMessage>(`/conversations/${externalId}/messages`, { text, inboxId: inbox.inboxId }, draftId);
    if (!message?.id || message.sendError) throw new Error("DELIVERY_UNCONFIRMED");
    return message.id;
  }
  const c = await prisma.conversation.findUniqueOrThrow({ where: { id: externalId }, include: { contact: true } });
  const id = `ai:${draftId}`;
  await prisma.chatMessage.create({ data: { id, conversationId: externalId, content: text, direction: "OUTBOUND",
    senderType: actor ? "AGENT" : "BOT", status: "sending", metadata: { source: "rocky-ai", draftId, approvedBy: actor } } });
  try {
    let providerId: string;
    if (channel === "telegram") {
      if (!c.telegramConnectionId || !c.telegramChatId || !telegramReplyWindow(c.telegramLastInboundAt)) throw new Error("TELEGRAM_NOT_READY");
      const sent = await telegramCommand<{ messageId: number }>("send", {
        connectionId: c.telegramConnectionId, chatId: c.telegramChatId, requestId: id, type: "TEXT", content: text,
      });
      providerId = telegramMessageKey(c.telegramConnectionId, c.telegramChatId, sent.messageId);
    } else {
      const recipient = normalizeYCloudPhone(c.contact.phoneNormalized ?? c.contact.phone ?? c.contact.externalId);
      if (!recipient || c.contact.externalId?.startsWith("SIMULATOR:")) throw new Error("INVALID_RECIPIENT");
      providerId = (await sendYCloudOutboundMessage({ recipient, content: text, type: "text", externalId: id })).messageId;
    }
    await prisma.chatMessage.update({ where: { id }, data: { externalMessageId: providerId, status: "accepted" } });
    await prisma.conversation.update({ where: { id: externalId }, data: { lastMessageAt: new Date() } });
    return providerId;
  } catch (error) {
    await prisma.chatMessage.updateMany({ where: { id, status: "sending" }, data: { status: "uncertain" } });
    throw error;
  }
}
