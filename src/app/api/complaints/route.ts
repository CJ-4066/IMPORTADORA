import { NextResponse } from "next/server";
import { z } from "zod";
import { ComplaintType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildComplaintCode } from "@/lib/complaints";

const complaintCreateSchema = z
  .object({
    kind: z.enum(["RECLAMO", "QUEJA"]),
    subject: z.string().trim().min(2).max(80),
    customerName: z.string().trim().min(3).max(180),
    customerPhone: z.string().trim().max(32).optional().or(z.literal("")),
    customerEmail: z.string().trim().email().max(180).optional().or(z.literal("")),
    documentNumber: z.string().trim().min(3).max(40),
    orderNumber: z.string().trim().max(80).optional().or(z.literal("")),
    productReference: z.string().trim().max(120).optional().or(z.literal("")),
    detail: z.string().trim().min(10).max(4000),
  })
  .superRefine((value, context) => {
    if (!value.customerPhone?.trim() && !value.customerEmail?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes dejar un teléfono o correo para seguimiento.",
        path: ["customerPhone"],
      });
    }
  });

export async function POST(request: Request) {
  try {
    const payload = complaintCreateSchema.parse(await request.json());
    const createdAt = new Date();
    const claimCode = buildComplaintCode(createdAt);

    const complaint = await prisma.complaint.create({
      data: {
        claimCode,
        kind: payload.kind as ComplaintType,
        subject: payload.subject,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone?.trim() || null,
        customerEmail: payload.customerEmail?.trim() || null,
        documentType: "Documento",
        documentNumber: payload.documentNumber,
        orderNumber: payload.orderNumber?.trim() || null,
        productReference: payload.productReference?.trim() || null,
        detail: payload.detail,
      },
      select: {
        claimCode: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      claimCode: complaint.claimCode,
      createdAt: complaint.createdAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : "No se pudo registrar el reclamo.";
    return NextResponse.json(
      {
        ok: false,
        message: message ?? "No se pudo registrar el reclamo.",
      },
      { status: 400 },
    );
  }
}
