import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type QuoteDefaults = {
  name: string | null;
  phone: string | null;
  email: string | null;
};

export async function getQuoteDefaultsForSession(): Promise<QuoteDefaults | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      name: true,
      phone: true,
    },
  });

  if (!user) {
    return {
      email: session.email,
      name: session.name,
      phone: null,
    };
  }

  return {
    email: user.email,
    name: user.name,
    phone: user.phone,
  };
}
