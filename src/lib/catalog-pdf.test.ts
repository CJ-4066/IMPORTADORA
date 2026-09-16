import assert from "node:assert/strict";
import test from "node:test";

import { isProjectorCatalogRequest } from "@/lib/catalog-pdf";

test("detecta solicitudes explícitas del catálogo de proyectores", () => {
  assert.equal(isProjectorCatalogRequest("Hola, catálogo de proyectores"), true);
  assert.equal(isProjectorCatalogRequest("CATALOGO PROYECTOR"), true);
  assert.equal(isProjectorCatalogRequest("¿Me mandas el catálogo de proyectores?"), true);
});

test("no intercepta consultas comunes ni catálogos de otra categoría", () => {
  assert.equal(isProjectorCatalogRequest("¿Qué proyectores tienes?"), false);
  assert.equal(isProjectorCatalogRequest("Catálogo de cámaras"), false);
  assert.equal(isProjectorCatalogRequest("Hola"), false);
});
