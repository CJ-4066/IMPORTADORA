import type { NextRequest } from "next/server";
import { getCatalogSearchDestination } from "@/lib/store";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const destination = await getCatalogSearchDestination(query);

  return Response.json({
    href: destination?.href ?? null,
    kind: destination?.kind ?? null,
  });
}
