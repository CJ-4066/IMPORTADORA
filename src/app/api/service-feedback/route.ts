import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const serviceFeedbackSchema = z
  .object({
    rating: z.enum(["VERY_GOOD", "GOOD", "REGULAR", "BAD"]),
    attendedBy: z.string().trim().max(180).optional().or(z.literal("")),
    improvement: z.string().trim().max(2000).optional().or(z.literal("")),
    hadProblem: z.boolean(),
    problemDetail: z.string().trim().max(2000).optional().or(z.literal("")),
    wouldRecommend: z.boolean(),
    customerContact: z.string().trim().max(180).optional().or(z.literal("")),
    website: z.string().max(200).optional(),
  })
  .superRefine((value, context) => {
    if (value.hadProblem && (value.problemDetail?.trim().length ?? 0) < 3) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cuéntanos brevemente qué problema tuviste.",
        path: ["problemDetail"],
      });
    }
  });

const submissionWindowMs = 10 * 60 * 1000;
const submissionLimit = 12;
const submissionAttempts = new Map<string, { count: number; resetAt: number }>();

function getRequestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

function allowSubmission(request: Request) {
  const fingerprint = getRequestFingerprint(request);
  const now = Date.now();
  const current = submissionAttempts.get(fingerprint);

  if (!current || current.resetAt <= now) {
    submissionAttempts.set(fingerprint, { count: 1, resetAt: now + submissionWindowMs });
    return true;
  }

  if (current.count >= submissionLimit) {
    return false;
  }

  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  try {
    if (!allowSubmission(request)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ya recibimos varias respuestas desde este dispositivo. Intenta nuevamente en unos minutos.",
        },
        { status: 429 },
      );
    }

    const payload = serviceFeedbackSchema.parse(await request.json());

    if (payload.website) {
      return NextResponse.json({ ok: true });
    }

    await prisma.serviceFeedback.create({
      data: {
        rating: payload.rating,
        attendedBy: payload.attendedBy?.trim() || null,
        improvement: payload.improvement?.trim() || null,
        hadProblem: payload.hadProblem,
        problemDetail: payload.problemDetail?.trim() || null,
        wouldRecommend: payload.wouldRecommend,
        customerContact: payload.customerContact?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : "No pudimos guardar tu opinión. Intenta nuevamente.";

    return NextResponse.json(
      {
        ok: false,
        message: message ?? "No pudimos guardar tu opinión. Intenta nuevamente.",
      },
      { status: 400 },
    );
  }
}
