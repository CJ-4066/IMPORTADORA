import assert from "node:assert/strict";
import { test } from "node:test";
import { exactSourceImageMatch, matchVisualEvidence, observationQueries, visualEvidenceForStorage } from "./visual-match";
import type { VisualObservation } from "./vision";

const observed: VisualObservation = {
  visibleText: ["HY300", "Proyector portátil"], brand: "Super Vision", model: "HY300", category: "proyector", color: "negro",
  readability: "clear", multipleProducts: false, canReadCode: true,
};

test("only a source hash tied to exactly one product becomes a verified identity", () => {
  const catalog = [{ id: "one", code: "HY300", sourceImageContentHash: "same" }];
  assert.equal(exactSourceImageMatch("same", catalog)?.status, "VERIFIED_EXACT");
  assert.equal(exactSourceImageMatch("other", catalog), null);
  assert.deepEqual(exactSourceImageMatch("same", [...catalog, { id: "two", code: "HY300B", sourceImageContentHash: "same" }]), {
    status: "UNVERIFIED", verifiedProductId: null, candidateProductIds: [], analyzer: "catalog-source-image-sha256", evidence: { reason: "shared_source_image" },
  });
});

test("observable text only creates bounded catalog candidates and never a visual assertion", async () => {
  const calls: string[] = [];
  const result = await matchVisualEvidence({ contentHash: "new-image", catalog: [], observe: async () => observed,
    search: async query => { calls.push(query); return query.includes("HY300") ? ["p1", "p2", "p3", "p4"] : []; } });
  assert.equal(result.status, "CANDIDATES");
  assert.equal(result.verifiedProductId, null);
  assert.deepEqual(result.candidateProductIds, ["p1", "p2", "p3"]);
  assert.ok(calls.length <= 4);
});

test("unreadable images, private data and weak terms never become a catalog query", async () => {
  const unreadable = { ...observed, readable: undefined, readability: "unreadable" as const, visibleText: ["cliente@example.com", "+51 999 888 777"], brand: null, model: null, category: null };
  assert.deepEqual(observationQueries(unreadable), []);
  let searched = false;
  const result = await matchVisualEvidence({ contentHash: "x", catalog: [], observe: async () => unreadable,
    search: async () => { searched = true; return ["unexpected"]; } });
  assert.equal(result.status, "UNVERIFIED");
  assert.equal(searched, false);
});

test("stored visual evidence excludes model-observed text and catalog queries", async () => {
  const result = await matchVisualEvidence({ contentHash: "new-image", catalog: [], observe: async () => ({
    ...observed, visibleText: ["Nombre de una persona", "Calle privada 123"], brand: "Marca", model: "Modelo",
  }), search: async () => ["p1"] });
  const stored = JSON.stringify(visualEvidenceForStorage(result));
  assert.equal(stored.includes("Nombre de una persona"), false);
  assert.equal(stored.includes("Calle privada"), false);
  assert.equal(stored.includes("Modelo"), false);
});
