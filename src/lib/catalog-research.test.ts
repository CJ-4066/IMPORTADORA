import assert from "node:assert/strict";
import test from "node:test";
import {
  CatalogResearchError,
  proposalToTechnicalSpecs,
  researchCatalogProduct,
} from "@/lib/catalog-research";

const product = {
  code: "P1028",
  name: "PARLANTE BT 40BT CON KARAOKE AWSS40BT",
  brand: "Aiwa",
  category: "PARLANTES",
  description: null,
  technicalSpecs: null,
  imageUrl: null,
};

const proposal = {
  identified: true,
  brand: "Aiwa",
  model: "AWSS40BT",
  confidence: 0.94,
  descriptionShort: "Parlante portátil con karaoke y conectividad Bluetooth.",
  descriptionFull: "Parlante portátil pensado para música y karaoke.",
  specifications: [
    { name: "Potencia", value: "10 W RMS" },
    { name: "Bluetooth", value: "5.0" },
  ],
  variants: [{ name: "Negro", hexColor: "#000000", sku: null }],
  videos: [{ title: "Presentación oficial", url: "https://www.youtube.com/watch?v=abc12345" }],
  documents: [{ title: "Manual", url: "https://aiwa.example/manual.pdf", type: "MANUAL" }],
  warnings: [],
  officialSourceUrls: ["https://aiwa.example/product"],
};

function providerResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: "completed",
    output: [
      {
        type: "web_search_call",
        action: {
          sources: [
            { url: "https://aiwa.example/product", title: "AWSS40BT | Aiwa" },
            { url: "https://retailer.example/awss40bt", title: "AWSS40BT" },
          ],
        },
      },
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(proposal), annotations: [] }],
      },
    ],
    ...overrides,
  };
}

test("requires a configured research provider", async () => {
  await assert.rejects(
    () => researchCatalogProduct(product, { apiKey: "" }),
    (error: unknown) =>
      error instanceof CatalogResearchError && error.code === "RESEARCH_PROVIDER_NOT_CONFIGURED",
  );
});

test("uses web search and returns a structured, sourced draft", async () => {
  const requestBodies: Record<string, unknown>[] = [];
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return Response.json(providerResponse());
  }) as typeof fetch;

  const result = await researchCatalogProduct(product, {
    apiKey: "test-key",
    model: "test-model",
    fetchImpl,
  });

  assert.equal(result.model, "test-model");
  assert.equal(result.proposal.model, "AWSS40BT");
  assert.equal(result.proposal.descriptionShort.length <= 180, true);
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources[0].isOfficial, true);
  const requestBody = requestBodies[0];
  assert.deepEqual(requestBody.tools, [{ type: "web_search" }]);
  assert.equal(requestBody.store, false);
  assert.equal((requestBody.text as { format: { type: string } }).format.type, "json_schema");
});

test("rejects proposals without provider-verifiable sources", async () => {
  const fetchImpl = (async () =>
    Response.json(
      providerResponse({
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(proposal) }] }],
      }),
    )) as typeof fetch;

  await assert.rejects(
    () => researchCatalogProduct(product, { apiKey: "test-key", fetchImpl }),
    (error: unknown) => error instanceof CatalogResearchError && error.code === "RESEARCH_SOURCES_MISSING",
  );
});

test("does not expose provider response details on HTTP failure", async () => {
  const fetchImpl = (async () => new Response("secret provider details", { status: 429 })) as typeof fetch;

  await assert.rejects(
    () => researchCatalogProduct(product, { apiKey: "test-key", fetchImpl }),
    (error: unknown) =>
      error instanceof CatalogResearchError &&
      error.code === "RESEARCH_PROVIDER_REJECTED" &&
      !error.publicMessage.includes("secret"),
  );
});

test("serializes structured specifications for legacy catalog consumers", () => {
  assert.equal(
    proposalToTechnicalSpecs(proposal),
    "- **Potencia:** 10 W RMS\n- **Bluetooth:** 5.0",
  );
});
