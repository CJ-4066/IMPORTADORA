import { prisma } from "@/lib/prisma";
import { inferStoreCategoryName } from "@/lib/product-category-classifier";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
  });
  const categoryByName = new Map(categories.map((category) => [category.name, category]));
  const products = await prisma.product.findMany({
    where: {
      isVisible: true,
      stockUnits: { gt: 0 },
      categoryId: null,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
    },
  });
  const planned = products
    .map((product) => {
      const categoryName = inferStoreCategoryName(product);
      const category = categoryName ? categoryByName.get(categoryName) : null;

      return {
        product,
        categoryName,
        category,
      };
    })
    .filter((item) => item.categoryName && item.category);

  const skipped = products.length - planned.length;
  const summary = new Map<string, number>();

  for (const item of planned) {
    summary.set(item.categoryName!, (summary.get(item.categoryName!) ?? 0) + 1);
  }

  console.log(`${DRY_RUN ? "Dry run" : "Backfill"} de categorias de productos`);
  console.log(`Productos sin categoria evaluados: ${products.length}`);
  console.log(`Productos clasificables: ${planned.length}`);
  console.log(`Productos omitidos: ${skipped}`);
  console.table(
    Array.from(summary.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category)),
  );

  if (DRY_RUN || !planned.length) {
    return;
  }

  await prisma.$transaction(
    planned.map((item) =>
      prisma.product.update({
        where: { id: item.product.id },
        data: {
          category: item.categoryName!,
          categoryId: item.category!.id,
        },
      }),
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
