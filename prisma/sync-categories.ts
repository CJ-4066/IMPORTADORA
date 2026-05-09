import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/lib/utils";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { category: { not: null } },
    select: { id: true, category: true },
  });

  const categoryNames = Array.from(
    new Set(products.flatMap((product) => (product.category ? [product.category.trim()] : []))),
  ).filter(Boolean);

  const categories = new Map<string, string>();

  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
      where: { name },
      update: { slug: slugify(name) },
      create: {
        name,
        slug: slugify(name),
      },
    });

    categories.set(name, category.id);
  }

  for (const product of products) {
    if (!product.category) {
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        categoryId: categories.get(product.category.trim()) ?? null,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
