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
];

function containsNormalized(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function createMockRepository(): ShopAssistantRepository {
  return {
    async getBaseData() {
      return { settings, categories };
    },
    async findProductByCode(code) {
      return products.find((product) => product.code.toLowerCase() === code.toLowerCase()) ?? null;
    },
    async searchVisibleProducts(query) {
      const lowered = query.toLowerCase();
      return products.filter((product) =>
        [product.code, product.name, product.description ?? "", product.brand ?? "", product.category ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(lowered),
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
  };
}

const answerShopAssistant = createShopAssistantService(createMockRepository());

test("muestra ofertas activas", async () => {
  const reply = await answerShopAssistant({ message: "muéstrame ofertas" });

  assert.equal(reply.products?.length, 2);
  assert.ok(reply.quickActions?.some((action) => action.href === "/?featured=1"));
  assert.ok(containsNormalized(reply.text, "ofertas activas"));
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

  assert.ok(containsNormalized(reply.text, "opciones parecidas"));
  assert.equal(reply.products?.[0].code, "GAS-200");
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
