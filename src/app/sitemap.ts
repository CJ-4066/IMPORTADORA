import type { MetadataRoute } from "next";
import { getActiveCategories } from "@/lib/store-catalog";
import { prisma } from "@/lib/prisma";
import { BLOCKED_PUBLIC_PRODUCT_CODES } from "@/lib/public-product-blocklist";
import { getPublicSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getPublicSiteUrl();

  const staticPages = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
  ];

  const categories = await getActiveCategories();
  const categoryUrls = categories.map((cat) => ({
    url: `${baseUrl}/categoria/${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const products = await prisma.product.findMany({
    where: {
      isVisible: true,
      NOT: {
        code: { in: BLOCKED_PUBLIC_PRODUCT_CODES },
      },
    },
    select: { slug: true, updatedAt: true },
  });

  const productUrls = products.map((product) => ({
    url: `${baseUrl}/producto/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...categoryUrls, ...productUrls];
}
