import { prisma } from "@/lib/prisma";
import { OrderStatus, Prisma } from "@prisma/client";

export async function getAdminOrders(input: { page: number; status: OrderStatus | "all" }) {
  const pageSize = 50;
  const skip = (input.page - 1) * pageSize;

  const where: Prisma.OrderWhereInput = {};
  if (input.status !== "all") {
    where.status = input.status;
  }

  const [totalResults, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        items: true,
      },
    }),
  ]);

  const totalPages = Math.ceil(totalResults / pageSize);

  const rawStats = await prisma.order.groupBy({
    by: ["status"],
    _count: true,
  });

  const stats = {
    all: 0,
    paid: 0,
    pending: 0,
    shipped: 0,
  };

  for (const row of rawStats) {
    stats.all += row._count;
    if (row.status === "PAID") stats.paid += row._count;
    if (row.status === "PENDING") stats.pending += row._count;
    if (row.status === "SHIPPED") stats.shipped += row._count;
  }

  return {
    orders: orders.map(o => {
       const itemCount = o.items.reduce((acc, i) => acc + i.quantity, 0);
       return { ...o, itemCount };
    }),
    totalResults,
    totalPages,
    page: input.page,
    pageSize,
    stats,
  };
}
