import type { VisualObservation } from "./vision";

export type CatalogVisualReference = {
  id: string;
  code: string;
  sourceImageContentHash: string | null;
};

export type VisualMatch =
  | { status: "VERIFIED_EXACT"; verifiedProductId: string; candidateProductIds: []; analyzer: "catalog-source-image-sha256"; evidence: { contentHash: string } }
  | { status: "CANDIDATES"; verifiedProductId: null; candidateProductIds: string[]; analyzer: "openai-visual-observation"; evidence: { observation: VisualObservation; queries: string[] } }
  | { status: "UNVERIFIED"; verifiedProductId: null; candidateProductIds: []; analyzer: "openai-visual-observation" | "catalog-source-image-sha256"; evidence: { observation?: VisualObservation; reason: "shared_source_image" | "insufficient_observable_evidence" } };

function usefulTerm(value: string | null | undefined) {
  if (!value) return null;
  const raw = value.trim().replace(/\s+/g, " ");
  if (/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(raw) || /(?<!\w)(?:\+?\d[\s()-]*){9,16}(?!\w)/.test(raw)) return null;
  const compact = raw.replace(/[^\p{L}\p{N} ._/-]/gu, "");
  if (compact.length < 2 || compact.length > 120 || /\[(?:correo|teléfono o documento)\]/i.test(compact)) return null;
  const hasUsefulToken = /\d/.test(compact) || /\p{L}{3,}/u.test(compact);
  return hasUsefulToken ? compact : null;
}

/** Bounded catalog lookups based on visible evidence only; model output is never an ID. */
export function observationQueries(observation: VisualObservation) {
  const model = usefulTerm(observation.model);
  const brand = usefulTerm(observation.brand);
  const category = usefulTerm(observation.category);
  const values = [model, ...observation.visibleText.map(usefulTerm)];
  if (brand && model) values.push(`${brand} ${model}`);
  if (brand && category) values.push(`${brand} ${category}`);
  return [...new Set(values.filter((value): value is string => Boolean(value)))].slice(0, 4);
}

export function exactSourceImageMatch(contentHash: string, catalog: readonly CatalogVisualReference[]): VisualMatch | null {
  const ids = [...new Set(catalog.filter(product => product.sourceImageContentHash === contentHash).map(product => product.id))];
  if (ids.length === 1) return { status: "VERIFIED_EXACT", verifiedProductId: ids[0]!, candidateProductIds: [],
    analyzer: "catalog-source-image-sha256", evidence: { contentHash } };
  if (ids.length > 1) return { status: "UNVERIFIED", verifiedProductId: null, candidateProductIds: [],
    analyzer: "catalog-source-image-sha256", evidence: { reason: "shared_source_image" } };
  return null;
}

/**
 * A visual observation can narrow a trusted catalog search, but it cannot make
 * an affirmative product identity. Only an exact server-side source hash does.
 */
export async function matchVisualEvidence(input: {
  contentHash: string;
  catalog: readonly CatalogVisualReference[];
  observe: () => Promise<VisualObservation>;
  search: (query: string) => Promise<readonly string[]>;
}): Promise<VisualMatch> {
  const exact = exactSourceImageMatch(input.contentHash, input.catalog);
  if (exact) return exact;
  const observation = await input.observe();
  if (observation.readability === "unreadable") {
    return { status: "UNVERIFIED", verifiedProductId: null, candidateProductIds: [], analyzer: "openai-visual-observation",
      evidence: { observation, reason: "insufficient_observable_evidence" } };
  }
  const queries = observationQueries(observation);
  const candidates: string[] = [];
  for (const query of queries) {
    for (const id of await input.search(query)) {
      if (!candidates.includes(id)) candidates.push(id);
      if (candidates.length === 3) break;
    }
    if (candidates.length === 3) break;
  }
  if (!candidates.length) {
    return { status: "UNVERIFIED", verifiedProductId: null, candidateProductIds: [], analyzer: "openai-visual-observation",
      evidence: { observation, reason: "insufficient_observable_evidence" } };
  }
  return { status: "CANDIDATES", verifiedProductId: null, candidateProductIds: candidates, analyzer: "openai-visual-observation",
    evidence: { observation, queries } };
}

/** Evidence persisted for review deliberately excludes model-observed free text and queries. */
export function visualEvidenceForStorage(match: VisualMatch) {
  if (match.status === "VERIFIED_EXACT") return match.evidence;
  if (match.status === "CANDIDATES") {
    const observation = match.evidence.observation;
    return { queryCount: match.evidence.queries.length, readability: observation.readability,
      multipleProducts: observation.multipleProducts, canReadCode: observation.canReadCode };
  }
  const observation = match.evidence.observation;
  return { reason: match.evidence.reason,
    ...(observation ? { readability: observation.readability, multipleProducts: observation.multipleProducts, canReadCode: observation.canReadCode } : {}) };
}
