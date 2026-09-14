import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { FlowCompiler } from "@/lib/automations/FlowCompiler";
import { N8nAutomationProvider } from "@/lib/automations/n8n-provider";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const resolvedParams = await params;
    const body = await request.json();
    const { draftVersionId } = body;

    const automation = await prisma.automation.findUnique({
      where: { id: resolvedParams.id },
    });

    const draft = await prisma.automationVersion.findUnique({
      where: { id: draftVersionId },
    });

    if (!automation || !draft) {
      return NextResponse.json({ error: "No se encontró el recurso." }, { status: 404 });
    }

    const flowDef = draft.flowDefinition as any;
    
    // 1. Compilar el formato visual al formato de n8n
    const n8nPayload = FlowCompiler.compile(automation.name, flowDef.nodes || [], flowDef.edges || []);
    
    // 2. Generar el Hash criptográfico para Drift Detection
    const compiledHash = FlowCompiler.generateDriftHash(n8nPayload);

    // 3. Desplegar a n8n
    const providerWorkflowId = await N8nAutomationProvider.deployWorkflow(n8nPayload, draft.providerWorkflowId || undefined);

    // 4. Actualizar la versión a "PUBLISHED" y guardar el hash y el ID remoto
    await prisma.automationVersion.update({
      where: { id: draft.id },
      data: {
        status: "PUBLISHED",
        compiledHash,
        providerWorkflowId
      }
    });

    // 5. Actualizar la automatización principal para apuntar a la versión publicada y activarla
    await prisma.automation.update({
      where: { id: automation.id },
      data: {
        status: "ACTIVE",
        currentPublishedVersionId: draft.id
      }
    });

    // Crear la siguiente versión "DRAFT" para continuar editando sin pisar producción
    const nextVersion = await prisma.automationVersion.create({
      data: {
        automationId: automation.id,
        version: draft.version + 1,
        flowDefinition: draft.flowDefinition as any,
        providerWorkflowId,
        status: "DRAFT"
      }
    });

    return NextResponse.json({ success: true, nextVersion });
  } catch (error: any) {
    console.error("Publish Error:", error);
    return NextResponse.json({ error: "Fallo al publicar en n8n", details: error.message }, { status: 500 });
  }
}
