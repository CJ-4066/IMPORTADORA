import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const envConfigured = Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
  const integration = await prisma.whatsappIntegration.findFirst({
    where: { status: "ACTIVE" },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      businessId: true,
      wabaId: true,
      phoneNumberId: true,
      displayPhoneNumber: true,
      verifiedName: true,
      status: true,
      scopes: true,
      lastVerifiedAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    configured: Boolean(integration) || envConfigured,
    source: integration ? "database/oauth" : envConfigured ? "env" : "none",
    integration,
    oauthConfiguration: {
      appIdConfigured: Boolean((process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID)?.trim()),
      loginConfigIdConfigured: Boolean(process.env.NEXT_PUBLIC_META_LOGIN_CONFIG_ID?.trim()),
      appSecretConfigured: Boolean(process.env.META_APP_SECRET?.trim()),
      tokenEncryptionConfigured: Boolean(process.env.META_TOKEN_ENCRYPTION_KEY?.trim()),
      graphVersion: process.env.NEXT_PUBLIC_META_GRAPH_VERSION?.trim() || process.env.META_GRAPH_VERSION?.trim() || "v26.0",
    },
    webhookSignatureConfigured: Boolean((process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET)?.trim()),
    realSendTested: false,
    realSendLabel: "Envío real: NO PROBADO",
  });
}
