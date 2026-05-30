import type { NextRequest } from "next/server";
import { getExactCatalogProductSlug } from "@/lib/store";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const slug = await getExactCatalogProductSlug(query);

  return Response.json({ slug });
}
