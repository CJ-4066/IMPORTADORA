import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();

    const automations = await prisma.automation.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { executions: true },
        },
      },
    });

    return NextResponse.json(automations);
  } catch (error) {
    console.error("GET /api/admin/automations error:", error);
    return NextResponse.json({ error: "No se pudieron cargar las automatizaciones" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();

    const { name, description, channel } = body;

    // Crear la automatización base junto con su primera versión DRAFT (version: 1)
    const automation = await prisma.automation.create({
      data: {
        name: name || "Nueva automatización",
        description: description || "",
        channel: channel || "WHATSAPP",
        status: "DRAFT",
        versions: {
          create: {
            version: 1,
            flowDefinition: { nodes: [], edges: [] },
            status: "DRAFT",
          },
        },
      },
      include: {
        versions: true,
      },
    });

    return NextResponse.json(automation, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/automations error:", error);
    return NextResponse.json({ error: "No se pudo crear la automatización" }, { status: 500 });
  }
}
