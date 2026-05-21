import { prisma } from "@/lib/prisma";
import { mirrorProductImageToLocal } from "@/lib/product-image-storage";

type BackfillProduct = {
  id: string;
  code: string;
  imageUrl: string | null;
  sourceImageUrl: string | null;
  localImageUrl: string | null;
  updatedAt: Date;
};

function getStoredLocalImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.startsWith("/") ? trimmed : null;
}

async function main() {
  let cursor: string | undefined;
  let processed = 0;
  let normalized = 0;
  let mirrored = 0;
  let skipped = 0;

  while (true) {
    const products: BackfillProduct[] = await prisma.product.findMany({
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        code: true,
        imageUrl: true,
        sourceImageUrl: true,
        localImageUrl: true,
        updatedAt: true,
      },
    });

    if (!products.length) {
      break;
    }

    for (const product of products) {
      processed += 1;

      const currentImageUrl = product.imageUrl?.trim() ?? "";
      const sourceImageUrl =
        product.sourceImageUrl?.trim() ||
        (currentImageUrl && !currentImageUrl.startsWith("/") ? currentImageUrl : null);
      const localImageUrl =
        product.localImageUrl?.trim() ||
        getStoredLocalImageUrl(currentImageUrl);

      if (!sourceImageUrl && !localImageUrl) {
        skipped += 1;
        continue;
      }

      if (localImageUrl && sourceImageUrl) {
        if (
          product.imageUrl !== localImageUrl ||
          product.sourceImageUrl !== sourceImageUrl ||
          product.localImageUrl !== localImageUrl
        ) {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              imageUrl: localImageUrl,
              sourceImageUrl,
              localImageUrl,
            },
          });
          normalized += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      if (sourceImageUrl && !localImageUrl) {
        const mirroredResult = await mirrorProductImageToLocal({
          code: product.code,
          sourceUrl: sourceImageUrl,
          versionKey: String(product.updatedAt.getTime()),
          previousLocalUrl: null,
        });

        if (mirroredResult.localUrl) {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              imageUrl: mirroredResult.localUrl,
              sourceImageUrl,
              localImageUrl: mirroredResult.localUrl,
            },
          });
          mirrored += 1;
        } else {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              sourceImageUrl,
            },
          });
          skipped += 1;
        }
      }
    }

    cursor = products[products.length - 1]?.id;
  }

  console.log(
    JSON.stringify(
      {
        processed,
        normalized,
        mirrored,
        skipped,
      },
      null,
      2,
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
