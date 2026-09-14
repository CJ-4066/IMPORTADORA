import { NextResponse } from "next/server";
import { processIncomingMessage } from "@/lib/messages-service";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const content = body.content || "Hola, este es un mensaje de prueba";
    const phone = body.phone || "+51 999 999 999";
    const name = body.name || "Usuario de Prueba";

    const result = await processIncomingMessage({
      channel: "WHATSAPP",
      content,
      externalContactId: phone,
      externalMessageId: `SIM-${randomUUID()}`,
      metadata: { source: "simulator" },
      name,
      phone,
      timestamp: new Date().toISOString(),
      type: "TEXT",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Simulation error:", error);
    return NextResponse.json({ error: "Failed to simulate message" }, { status: 500 });
  }
}
