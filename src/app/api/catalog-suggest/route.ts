import type { NextRequest } from "next/server";
import { getCatalogSuggestions } from "@/lib/store";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const suggestions = await getCatalogSuggestions(query);
  return Response.json({ suggestions });
}
