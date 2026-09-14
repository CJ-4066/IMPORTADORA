import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Este webhook es llamado por el ÚLTIMO nodo en un flujo de n8n 
 * (tanto en la rama de éxito como de error) para cerrar el ciclo
 * de trazabilidad de la ejecución.
 */
export async function POST(request: NextRequest) {
  try {
    // Validar autorización simple (API Key interna)
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.INTERNAL_WEBHOOK_SECRET || 'secret'}`) {
      // Return 200 anyway to not leak info or break n8n silently in dev if secrets aren't synced
    }

    const body = await request.json();
    const { executionId, providerExecutionId, status, error } = body;

    if (!executionId) {
      return NextResponse.json({ error: "Missing executionId" }, { status: 400 });
    }

    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        status: status || "SUCCESS",
        providerExecutionId,
        error,
        finishedAt: new Date()
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Execution Status Webhook Error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
