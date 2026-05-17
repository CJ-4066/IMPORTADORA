import assert from "node:assert/strict";
import test from "node:test";
import type {
  AssistantCategoryRecord,
  AssistantProductRecord,
  AssistantSettingsRecord,
  ShopAssistantRepository,
} from "@/lib/shop-assistant";
import { createShopAssistantService } from "@/lib/shop-assistant";

const settings: AssistantSettingsRecord = {
  businessName: "Importaciones Super",
  currencySymbol: "S/",
  supportHours: "Lun a sáb 8:00 am - 7:00 pm",
  whatsappNumber: "51999999999",
};

const categories: AssistantCategoryRecord[] = [
  { id: "cat-bebidas", name: "Bebidas", slug: "bebidas" },
  { id: "cat-limpieza", name: "Limpieza", slug: "limpieza" },
  { id: "cat-audio", name: "Auriculares", slug: "auriculares" },
];

const products: AssistantProductRecord[] = [
  {
    id: "p1",
    slug: "agua-de-mesa-625ml-aga-100",
    code: "AGA-100",
    name: "Agua de Mesa 625ml",
    description: "Caja ideal para reposición rápida.",
    brand: "Aqua Fresh",
    category: "Bebidas",
    categoryId: "cat-bebidas",
    unitPrice: 1.4,
    wholesalePrice: 1.25,
    wholesaleMinQty: 12,
    boxPrice: 30,
    unitsPerBox: 24,
    stockUnits: 48,
  },
  {
    id: "p2",
    slug: "gaseosa-naranja-500ml-gas-200",
    code: "GAS-200",
    name: "Gaseosa Naranja 500ml",
    description: "Bebida de impulso para mostrador.",
    brand: "Fizz Pop",
    category: "Bebidas",
    categoryId: "cat-bebidas",
    unitPrice: 2.4,
    wholesalePrice: 2.1,
    wholesaleMinQty: 6,
    boxPrice: 54,
    unitsPerBox: 24,
    stockUnits: 60,
  },
  {
    id: "p3",
    slug: "lejia-multiusos-1l-lim-310",
    code: "LIM-310",
    name: "Lejía Multiusos 1L",
    description: "Limpieza de hogar y negocio.",
    brand: "Clean House",
    category: "Limpieza",
    categoryId: "cat-limpieza",
    unitPrice: 4.5,
    wholesalePrice: null,
    wholesaleMinQty: 3,
    boxPrice: null,
    unitsPerBox: null,
    stockUnits: 8,
  },
  {
    id: "p4",
    slug: "audifono-bluetooth-basico-aud-025",
    code: "AUD-025",
    name: "Audifono Bluetooth Basico",
    description: "Audio compacto para uso diario.",
    brand: "Sound Max",
    category: "Auriculares",
    categoryId: "cat-audio",
    unitPrice: 24.9,
    wholesalePrice: 22,
    wholesaleMinQty: 6,
    boxPrice: null,
    unitsPerBox: null,
    stockUnits: 20,
  },
  {
    id: "p5",
    slug: "auricular-bluetooth-pro-aud-040",
    code: "AUD-040",
    name: "Auricular Bluetooth Pro",
    description: "Audio inalambrico con estuche.",
    brand: "Sound Max",
    category: "Auriculares",
    categoryId: "cat-audio",
    unitPrice: 39.9,
    wholesalePrice: 35,
    wholesaleMinQty: 6,
    boxPrice: null,
    unitsPerBox: null,
    stockUnits: 15,
  },
];

function containsNormalized(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function createMockRepository(
  overrides: Partial<ShopAssistantRepository> = {},
): ShopAssistantRepository {
  return {
    async getBaseData() {
      return { settings, categories };
    },
    async findProductByCode(code) {
      return products.find((product) => product.code.toLowerCase() === code.toLowerCase()) ?? null;
    },
    async searchVisibleProducts(query) {
      const tokens = query
        .toLowerCase()
        .split(" ")
        .filter((token) => token.length >= 2);
      return products.filter((product) =>
        tokens.some((token) =>
          [product.code, product.name, product.description ?? "", product.brand ?? "", product.category ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(token),
        ),
      );
    },
    async getFeaturedProducts() {
      return [products[0], products[1]];
    },
    async getCategoryProducts(categoryId) {
      return products.filter((product) => product.categoryId === categoryId);
    },
    async getRelatedProducts(product) {
      return products.filter(
        (candidate) => candidate.id !== product.id && candidate.categoryId === product.categoryId,
      );
    },
    ...overrides,
  };
}

const answerShopAssistant = createShopAssistantService(createMockRepository());

test("muestra ofertas activas", async () => {
  const reply = await answerShopAssistant({ message: "muéstrame ofertas" });

  assert.equal(reply.products?.length, 2);
  assert.ok(reply.quickActions?.some((action) => action.href === "/?featured=1"));
  assert.ok(containsNormalized(reply.text, "ofertas activas"));
});

test("recomienda un regalo con presupuesto y contexto de ocasión", async () => {
  const reply = await answerShopAssistant({
    message: "recomiendame algo para regalar por cumpleaños con presupuesto 25 soles",
  });

  assert.equal(reply.products?.[0].code, "AUD-025");
  assert.ok(containsNormalized(reply.text, "cumpleaños"));
  assert.ok(containsNormalized(reply.text, "25"));
});

test("usa fallback cuando no hay ofertas activas marcadas", async () => {
  const fallbackAssistant = createShopAssistantService(
    createMockRepository({
      async getFeaturedProducts() {
        return [];
      },
    }),
  );

  const reply = await fallbackAssistant({ message: "muéstrame ofertas" });

  assert.ok(reply.products?.length);
  assert.ok(containsNormalized(reply.text, "no veo ofertas activas marcadas"));
});

test("resuelve categorías activas", async () => {
  const reply = await answerShopAssistant({ message: "qué categorías tienes" });

  assert.ok(containsNormalized(reply.text, "bebidas"));
  assert.ok(containsNormalized(reply.text, "limpieza"));
  assert.ok(reply.quickActions?.some((action) => action.href === "/?category=bebidas"));
});

test("resuelve precio por código aunque el código venga con espacios", async () => {
  const reply = await answerShopAssistant({ message: "precio del codigo aga 100" });

  assert.equal(reply.contextProductCode, "AGA-100");
  assert.ok(containsNormalized(reply.text, "precio unitario"));
  assert.ok(containsNormalized(reply.text, "mayorista desde 12"));
  assert.ok(reply.products?.[0].code === "AGA-100");
});

test("usa el contexto para responder seguimiento de precio sin mostrar cajón", async () => {
  const reply = await answerShopAssistant({
    message: "y por mayor cuanto cuesta",
    productContextCode: "AGA-100",
  });

  assert.equal(reply.contextProductCode, "AGA-100");
  assert.ok(containsNormalized(reply.text, "precio unitario"));
  assert.ok(containsNormalized(reply.text, "mayorista desde 12"));
  assert.ok(!containsNormalized(reply.text, "cajón"));
});

test("devuelve productos similares cuando el usuario lo pide", async () => {
  const reply = await answerShopAssistant({
    message: "tienes algo parecido",
    productContextCode: "AGA-100",
  });

  assert.ok(containsNormalized(reply.text, "mejor alternativa"));
  assert.equal(reply.products?.[0].code, "GAS-200");
});

test("usa memoria para calcular cantidad y precio mayorista", async () => {
  const reply = await answerShopAssistant({
    message: "quiero 12 unidades",
    productContextCode: "AGA-100",
  });

  assert.equal(reply.products?.[0].code, "AGA-100");
  assert.equal(reply.products?.[0].recommendedQuantity, 12);
  assert.ok(containsNormalized(reply.text, "aplica mayorista"));
  assert.ok(containsNormalized(reply.text, "12"));
});

test("ordena recomendaciones por presupuesto cercano", async () => {
  const reply = await answerShopAssistant({
    message: "quiero audifonos y mi presupuesto es 25 soles",
  });

  assert.equal(reply.products?.[0].code, "AUD-025");
  assert.ok(containsNormalized(reply.text, "más cercana"));
  assert.ok(containsNormalized(reply.text, "S/ 25"));
});

test("no confunde scooter electrico con hervidor electrico", async () => {
  const reply = await answerShopAssistant({
    message: "necesito un scoter electrico que opciones me recomiendas",
  });

  assert.ok(containsNormalized(reply.text, "no encontré una coincidencia clara"));
  assert.ok(!reply.products?.some((product) => containsNormalized(product.name, "hervidor")));
});

test("sugiere scooter cuando el usuario escribe scuter", async () => {
  const reply = await answerShopAssistant({
    message: "necesito un scuter",
  });

  assert.ok(containsNormalized(reply.text, "quizá quisiste decir"));
  assert.ok(containsNormalized(reply.text, "scooter"));
});

test("corrige errores comunes de escritura antes de buscar", async () => {
  const reply = await answerShopAssistant({
    message: "busco audiphonos",
  });

  assert.ok(reply.products?.some((product) => product.code === "AUD-025"));
});

test("sugiere correcciones cuando la palabra mal escrita no tiene resultados", async () => {
  const reply = await answerShopAssistant({
    message: "busco mause gamer",
  });

  assert.ok(containsNormalized(reply.text, "quizá quisiste decir"));
  assert.ok(containsNormalized(reply.text, "mouse"));
});

test("responde soporte y flujo de compra", async () => {
  const reply = await answerShopAssistant({ message: "como envio mi pedido por whatsapp" });

  assert.ok(containsNormalized(reply.text, "enviar pedido"));
  assert.ok(containsNormalized(reply.text, settings.supportHours));
  assert.ok(reply.quickActions?.some((action) => action.href.startsWith("https://wa.me/")));
});

test("da fallback claro cuando no entiende", async () => {
  const reply = await answerShopAssistant({ message: "necesito algo rarisimo sin contexto" });

  assert.ok(containsNormalized(reply.text, "no encontré una coincidencia clara"));
  assert.ok(reply.suggestedPrompts?.length);
});
