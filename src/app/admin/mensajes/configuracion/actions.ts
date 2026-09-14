"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleBotAction(formData: FormData) {
  const currentState = formData.get("currentState") === "true";
  
  const settings = await prisma.storeSettings.findFirst();
  if (settings) {
    await prisma.storeSettings.update({
      where: { id: settings.id },
      data: { botMasterSwitch: !currentState }
    });
  }
  revalidatePath("/admin/mensajes/configuracion");
}

export async function saveSettingsAction(formData: FormData) {
  const url = formData.get("n8nWebhookUrl") as string;
  
  const settings = await prisma.storeSettings.findFirst();
  if (settings) {
    await prisma.storeSettings.update({
      where: { id: settings.id },
      data: { n8nWebhookUrl: url }
    });
  }
  revalidatePath("/admin/mensajes/configuracion");
}
