import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/producto/*", "/categoria/*", "/p/*"],
      disallow: [
        "/admin/*",
        "/api/*",
        "/checkout/*",
        "/carrito/*",
        "/cuenta/*",
        "/login",
        "/*?*collection=*",
        "/*?*sort=*",
        "/*?*page=*",
        "/*?*focus=*",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
