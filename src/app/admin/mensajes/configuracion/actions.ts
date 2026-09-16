"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type MessagingSettingsActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const webhookSchema = z.object({
  n8nWebhookUrl: z
    .string()
    .trim()
    .refine((value) => value === "" || z.url().safeParse(value).success, "Ingresa una URL válida.")
    .refine((value) => value === "" || value.startsWith("https://"), "La URL debe usar HTTPS."),
});

export async function toggleBotAction() {
  await requireAdmin();
  const settings = await prisma.storeSettings.findFirst();

  if (settings) {
    await prisma.storeSettings.update({
      where: { id: settings.id },
      data: { botMasterSwitch: !settings.botMasterSwitch },
    });
  } else {
    await prisma.storeSettings.create({ data: { id: 1, botMasterSwitch: false } });
  }

  revalidatePath("/admin/mensajes/configuracion");
}

export async function saveSettingsAction(
  _previousState: MessagingSettingsActionState,
  formData: FormData,
): Promise<MessagingSettingsActionState> {
  await requireAdmin();
  const result = webhookSchema.safeParse({ n8nWebhookUrl: formData.get("n8nWebhookUrl") });

  if (!result.success) {
    return { status: "error", message: result.error.issues[0]?.message || "Revisa la URL ingresada." };
  }

  const settings = await prisma.storeSettings.findFirst();
  if (settings) {
    await prisma.storeSettings.update({
      where: { id: settings.id },
      data: { n8nWebhookUrl: result.data.n8nWebhookUrl || null },
    });
  } else {
    await prisma.storeSettings.create({
      data: { id: 1, n8nWebhookUrl: result.data.n8nWebhookUrl || null },
    });
  }

  revalidatePath("/admin/mensajes/configuracion");
  return {
    status: "success",
    message: result.data.n8nWebhookUrl ? "Webhook guardado correctamente." : "Webhook eliminado.",
  };
}
