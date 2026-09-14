import { handleInternalProductSearchRequest } from "@/lib/internal-product-search";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleInternalProductSearchRequest(request);
}
