import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const resolvedParams = await params;

    const automation = await prisma.automation.findUnique({
      where: { id: resolvedParams.id },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 10,
        },
      },
    });

    if (!automation) {
      return NextResponse.json({ error: "Automatización no encontrada" }, { status: 404 });
    }

    return NextResponse.json(automation);
  } catch (error) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const resolvedParams = await params;
    const body = await request.json();
    const { name, description, status, flowDefinition, draftVersionId, currentVersionNumber } = body;

    if (draftVersionId && currentVersionNumber) {
      const existingDraft = await prisma.automationVersion.findUnique({
        where: { id: draftVersionId },
      });

      if (!existingDraft) {
        return NextResponse.json({ error: "El borrador no existe" }, { status: 404 });
      }

      if (existingDraft.version !== currentVersionNumber) {
        return NextResponse.json({ 
          error: "Conflicto de edición concurrente.",
          message: "Esta automatización fue modificada por otro usuario recientemente." 
        }, { status: 409 });
      }

      await prisma.automationVersion.update({
        where: { id: draftVersionId },
        data: {
          flowDefinition,
          version: { increment: 1 },
        },
      });
    }

    if (name || description || status) {
      await prisma.automation.update({
        where: { id: resolvedParams.id },
        data: {
          ...(name && { name }),
          ...(description && { description }),
          ...(status && { status }),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/automations/[id] error:", error);
    return NextResponse.json({ error: "No se pudo actualizar la automatización" }, { status: 500 });
  }
}
