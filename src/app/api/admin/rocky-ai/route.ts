import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { approveDraft, audit, configureConversation, conversationStatus, discardDraft, emergencyStop, generateDraft, saveSettings, settings } from "@/lib/rocky-ai/service";
import { targetSchema, targetKey, modes, renderDecision, decisionSchema } from "@/lib/rocky-ai/policy";
import { emptyPolicies } from "@/lib/rocky-ai/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const actions = z.discriminatedUnion("action", [
  targetSchema.extend({ action: z.literal("configure"), mode: z.enum(modes), humanControl: z.boolean() }),
  targetSchema.extend({ action: z.literal("generate") }),
  z.object({ action: z.literal("approve"), draftId: z.string().uuid(), text: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("discard"), draftId: z.string().uuid() }),
  z.object({ action: z.literal("settings"), settings: z.unknown() }),
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("simulate"), decision: decisionSchema }),
]);
function failure(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Revisa los campos del formulario." }, { status: 400 });
  const message = error instanceof Error ? error.message : "";
  const known: Record<string, string> = {
    OPENAI_NOT_CONFIGURED_OR_DISABLED: "Configura OPENAI_API_KEY en el servidor y activa Super Bot.",
    MODE_OFF: "Selecciona un modo de IA antes de generar una sugerencia.",
    DRAFT_EXPIRED: "La sugerencia perdió vigencia. Genera otra antes de enviar.",
    DRAFT_ALREADY_PROCESSED: "Esta sugerencia ya fue procesada.",
    CONTEXT_CHANGED: "Llegó un mensaje nuevo. Genera otra sugerencia.",
    CONTROL_CHANGED: "Cambió el control de la conversación.",
    DAILY_LIMIT: "Se alcanzó el límite diario de uso.",
    MESSENGER_CONTROL_REQUIRED: "Configura el control de Messenger antes de activar IA.",
    CHANNEL_NOT_OWNED: "No se pudo confirmar el control exclusivo del canal.",
  };
  return NextResponse.json({ error: known[message] ?? "No se pudo completar la operación. Revisa la conexión y el control del canal." }, { status: 409 });
}
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (session?.role !== "ADMIN") return NextResponse.json({ error: "Acceso no autorizado." }, { status: 401 });
  try {
    if (request.nextUrl.searchParams.has("externalId")) {
      const target = targetSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
      return NextResponse.json(await conversationStatus(target.channel, target.externalId), { headers: { "Cache-Control": "no-store" } });
    }
    const config = await settings();
    const day = new Date(new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10) + "T05:00:00Z");
    const [usage, drafts, events, conversations] = await Promise.all([
      prisma.rockyAiUsage.aggregate({ where: { createdAt: { gte: day } }, _count: true, _sum: { inputTokens: true, outputTokens: true, reservedTokens: true } }),
      prisma.rockyAiDraft.groupBy({ by: ["state"], _count: true }),
      prisma.rockyAiAudit.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.rockyAiConversation.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
    ]);
    return NextResponse.json({ config, configured: Boolean(process.env.OPENAI_API_KEY), usage, drafts, events, conversations }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (session?.role !== "ADMIN") return NextResponse.json({ error: "Acceso no autorizado." }, { status: 401 });
  try {
    const origin = new URL(request.headers.get("origin") || "");
    if (!["http:", "https:"].includes(origin.protocol) || origin.host !== request.headers.get("host")?.toLowerCase()) throw new Error();
  } catch { return NextResponse.json({ error: "Origen no autorizado." }, { status: 403 }); }
  try {
    if (Number(request.headers.get("content-length") || 0) > 20000) return NextResponse.json({ error: "Solicitud demasiado grande." }, { status: 413 });
    const action = actions.parse(await request.json());
    const actor = session.userId;
    switch (action.action) {
      case "settings": await saveSettings(action.settings, actor); break;
      case "stop": await emergencyStop(actor); break;
      case "configure": await configureConversation(action.channel, action.externalId, action.mode, action.humanControl, actor); break;
      case "generate": {
        const draft = await generateDraft(targetKey(action.channel, action.externalId), actor, true);
        if (!draft) return NextResponse.json({ error: "Ya se está procesando esta conversación." }, { status: 409 });
        break;
      }
      case "approve": {
        if (!await approveDraft(action.draftId, action.text, actor)) return NextResponse.json({ error: "La conversación está ocupada. Actualiza su estado." }, { status: 409 });
        break;
      }
      case "discard": await discardDraft(action.draftId, actor); break;
      case "simulate": {
        const config = await settings();
        const result = renderDecision(action.decision, [{ id: "demo", name: "Producto de prueba", code: "DEMO", price: 20, stock: 10, wholesalePrice: 18, wholesaleMinQty: 3 }], { ...emptyPolicies, ...(config.policies as object) });
        await audit(actor, "simulation");
        return NextResponse.json({ ...result, simulation: true, notice: "Simulación de reglas con datos ficticios. No usa OpenAI ni envía mensajes." });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
