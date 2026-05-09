"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clearSession, createSession } from "@/lib/auth";
import { parseLoginForm, parseShopperRegisterForm } from "@/lib/validation";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function shopperLoginAction(formData: FormData) {
  const { email, password } = parseLoginForm(formData);
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (
    !user ||
    user.role !== "USERSHOP" ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    redirect("/acceso?mode=login&error=Credenciales%20inv%C3%A1lidas");
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: "USERSHOP",
  });

  redirect("/cuenta");
}

export async function shopperRegisterAction(formData: FormData) {
  const { name, email, phone, password } = parseShopperRegisterForm(formData);
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    redirect("/acceso?mode=register&error=Ese%20correo%20ya%20est%C3%A1%20registrado");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      phone,
      passwordHash,
      role: "USERSHOP",
    },
  });

  redirect("/acceso?mode=login&status=Cuenta%20creada.%20Ya%20puedes%20ingresar");
}

export async function shopperLogoutAction() {
  await clearSession();
  redirect("/");
}
