import { catalogRequestText, isCatalogRequest } from "../catalog-request";
import type { CatalogPreparedRequest } from "../catalog-generation";
import { productQueryTerms } from "../rocky-product-query";
import type { HistoryItem } from "./policy";

type PrepareCatalog = (content: string) => Promise<CatalogPreparedRequest>;

export type SuperBotCatalogPlan = {
  request: string;
  fromConversationContext: boolean;
  prepared: Exclude<CatalogPreparedRequest, { kind: "not-catalog" }>;
};

function isExplicitGeneralCatalog(text: string) {
  return /\b(general|completo|completa|todos|todas|todo|toda|entero|entera)\b/i.test(text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

/** A bare "pásame el catálogo" inherits the latest meaningful customer
 * product request. The inherited text still goes through the same server-side
 * catalog parser and snapshot builder; a model never supplies product IDs,
 * brands, URLs, prices, or availability. */
function priorCatalogTerms(history: HistoryItem[]) {
  for (const turn of [...history].reverse()) {
    if (turn.role !== "user" || isCatalogRequest(turn.text)) continue;
    const terms = productQueryTerms(turn.text);
    if (terms.length) return terms.join(" ");
  }
  return null;
}

export async function prepareSuperBotCatalog(history: HistoryItem[], prepare?: PrepareCatalog): Promise<SuperBotCatalogPlan | null> {
  const latestIndex = history.map(turn => turn.role).lastIndexOf("user");
  const latest = latestIndex < 0 ? undefined : history[latestIndex];
  if (!latest || !isCatalogRequest(latest.text)) return null;
  // Avoid loading PDF/outbox code for ordinary chat messages. The dynamic
  // import runs only after the bounded catalog vocabulary detector matched.
  const resolve = prepare ?? (await import("../catalog-generation")).prepareCatalogRequest;

  const requestText = catalogRequestText(latest.text) ?? "";
  const bareRequest = !productQueryTerms(requestText).length && !isExplicitGeneralCatalog(requestText);
  if (bareRequest) {
    const terms = priorCatalogTerms(history.slice(0, latestIndex));
    if (terms) {
      const contextualRequest = `catálogo de ${terms}`;
      const contextual = await resolve(contextualRequest);
      if (contextual.kind !== "not-catalog") return { request: contextualRequest, fromConversationContext: true, prepared: contextual };
    }
  }

  const prepared = await resolve(latest.text);
  return prepared.kind === "not-catalog" ? null : { request: latest.text, fromConversationContext: false, prepared };
}

