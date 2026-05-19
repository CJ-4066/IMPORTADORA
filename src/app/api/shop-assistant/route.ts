import { answerShopAssistant } from "@/lib/shop-assistant";
import type { ShopAssistantRequest } from "@/lib/shop-assistant-types";
import { rewriteAssistantTextWithOllama } from "@/lib/ollama";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ShopAssistantRequest>;
    const message = typeof body.message === "string" ? body.message.slice(0, 280) : "";
    const productContextCode =
      typeof body.productContextCode === "string" ? body.productContextCode : null;
    const contextCategorySlug =
      typeof body.contextCategorySlug === "string" ? body.contextCategorySlug : null;
    const recentMessages = Array.isArray(body.recentMessages)
      ? body.recentMessages
          .filter(
            (item): item is { role: "assistant" | "user"; text: string } =>
              Boolean(item) &&
              (item.role === "assistant" || item.role === "user") &&
              typeof item.text === "string",
          )
          .slice(-6)
      : [];

    const reply = await answerShopAssistant({
      message,
      productContextCode,
      contextCategorySlug,
      recentMessages,
    });

    const enhancedReply = await rewriteAssistantTextWithOllama({
      customerMessage: message,
      reply,
    });

    return Response.json(enhancedReply);
  } catch {
    return Response.json(
      {
        text: "No pude procesar esa consulta ahora. Intenta con un código, nombre o categoría.",
        suggestedPrompts: [
          "Busca por código",
          "Muéstrame ofertas",
          "¿Cómo envío mi pedido?",
        ],
      },
      { status: 500 },
    );
  }
}
