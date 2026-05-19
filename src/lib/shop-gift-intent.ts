export type GiftSeason =
  | "christmas"
  | "mothers_day"
  | "fathers_day"
  | "valentines"
  | "childrens_day"
  | "none";

export type GiftProfile =
  | "mother"
  | "father"
  | "partner"
  | "woman"
  | "man"
  | "child"
  | "gamer"
  | "office"
  | "student"
  | "generic";

export type GiftIntentResult = {
  isGiftIntent: boolean;
  season: GiftSeason;
  profile: GiftProfile;
  budget?: number | null;
  keywords: string[];
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectGiftSeason(message: string): GiftSeason {
  const text = normalizeText(message);

  if (text.includes("navidad") || text.includes("papa noel")) {
    return "christmas";
  }

  if (text.includes("dia de la madre") || text.includes("mama") || text.includes("madre")) {
    return "mothers_day";
  }

  if (text.includes("dia del padre") || text.includes("papa") || text.includes("padre")) {
    return "fathers_day";
  }

  if (text.includes("san valentin") || text.includes("14 de febrero") || text.includes("enamorados")) {
    return "valentines";
  }

  if (text.includes("dia del niño") || text.includes("dia del nino")) {
    return "childrens_day";
  }

  return "none";
}

export function detectGiftProfile(message: string, season: GiftSeason): GiftProfile {
  const text = normalizeText(message);

  if (text.includes("gamer") || text.includes("juega") || text.includes("gaming")) {
    return "gamer";
  }

  if (text.includes("mama") || text.includes("madre")) return "mother";
  if (text.includes("papa") || text.includes("padre")) return "father";

  if (
    text.includes("novia") ||
    text.includes("novio") ||
    text.includes("esposa") ||
    text.includes("esposo") ||
    text.includes("pareja")
  ) {
    return "partner";
  }

  if (text.includes("mujer") || text.includes("ella") || text.includes("chica")) {
    return "woman";
  }

  if (text.includes("hombre") || text.includes(" el ") || text.includes("chico")) {
    return "man";
  }

  if (text.includes("nino") || text.includes("niño") || text.includes("hijo") || text.includes("hija") || text.includes("sobrino") || text.includes("sobrina")) {
    return "child";
  }

  if (text.includes("oficina") || text.includes("trabajo")) return "office";
  if (text.includes("estudiante") || text.includes("estudiar")) return "student";

  if (season === "mothers_day") return "mother";
  if (season === "fathers_day") return "father";
  if (season === "valentines") return "partner";
  if (season === "childrens_day") return "child";

  return "generic";
}

export function detectBudget(message: string): number | null {
  const text = normalizeText(message);
  const match = text.match(/(?:menos de|hasta|maximo|max|por)\s*(?:s\/)?\s*(\d+)/);

  if (!match?.[1]) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function getGiftKeywords(profile: GiftProfile, season: GiftSeason) {
  const base = [
    "audifono",
    "auricular",
    "parlante",
    "smartwatch",
    "reloj",
    "lampara",
    "cargador",
    "mouse",
    "teclado",
  ];

  const byProfile: Record<GiftProfile, string[]> = {
    mother: ["lampara", "hogar", "reloj", "parlante", "cocina", "organizador"],
    father: ["herramienta", "parlante", "reloj", "cargador", "linterna", "auto"],
    partner: ["reloj", "parlante", "audifono", "lampara", "smartwatch"],
    woman: ["reloj", "lampara", "audifono", "parlante", "hogar"],
    man: ["parlante", "audifono", "mouse", "reloj", "herramienta"],
    child: ["audifono", "parlante", "mouse", "teclado", "juguete", "luces"],
    gamer: ["mouse", "teclado", "audifono", "parlante", "rgb", "pad"],
    office: ["silla", "lampara", "mouse", "teclado", "organizador"],
    student: ["audifono", "mouse", "teclado", "lampara", "mochila"],
    generic: base,
  };

  const bySeason: Record<GiftSeason, string[]> = {
    christmas: ["parlante", "audifono", "reloj", "smartwatch", "luces", "regalo"],
    mothers_day: ["lampara", "hogar", "reloj", "parlante", "cocina"],
    fathers_day: ["parlante", "herramienta", "reloj", "cargador", "linterna"],
    valentines: ["reloj", "parlante", "audifono", "lampara"],
    childrens_day: ["juguete", "audifono", "luces", "parlante"],
    none: [],
  };

  return Array.from(new Set([...byProfile[profile], ...bySeason[season], ...base]));
}

export function detectGiftIntent(message: string): GiftIntentResult {
  const text = normalizeText(message);

  const giftWords = [
    "regalo",
    "regalar",
    "detalle",
    "sorpresa",
    "obsequio",
    "navidad",
    "madre",
    "mama",
    "padre",
    "papa",
    "novia",
    "novio",
    "pareja",
    "bonito",
    "bonita",
  ];

  const hasGiftSignal = giftWords.some((word) => text.includes(word));
  const season = hasGiftSignal ? detectGiftSeason(message) : "none";
  const isGiftIntent = hasGiftSignal || season !== "none";
  const profile = detectGiftProfile(message, season);
  const budget = detectBudget(message);

  return {
    isGiftIntent,
    season,
    profile,
    budget,
    keywords: getGiftKeywords(profile, season),
  };
}

export function buildGiftReply(
  giftIntent: GiftIntentResult,
  products: Array<{ name: string }>,
) {
  const seasonLabel: Record<GiftSeason, string> = {
    christmas: "Navidad",
    mothers_day: "el Día de la Madre",
    fathers_day: "el Día del Padre",
    valentines: "San Valentín",
    childrens_day: "el Día del Niño",
    none: "",
  };

  const profileLabel: Record<GiftProfile, string> = {
    mother: "mamá",
    father: "papá",
    partner: "tu pareja",
    woman: "ella",
    man: "él",
    child: "niño/a",
    gamer: "alguien gamer",
    office: "oficina",
    student: "estudiante",
    generic: "",
  };

  const season = seasonLabel[giftIntent.season] ?? "";
  const profile = profileLabel[giftIntent.profile] ?? "";
  const context = [profile ? `para ${profile}` : "", season ? `por ${season}` : ""]
    .filter(Boolean)
    .join(" ");

  if (products.length === 1) {
    return `Te recomiendo esta opción ${context || "como regalo"}. Tiene stock disponible y puede funcionar muy bien como regalo.`;
  }

  return `Te recomiendo estas opciones ${context || "como regalo"}. Son productos con stock y buena salida para regalo.`;
}

export function getStrictGiftTerms(profile: GiftProfile) {
  const strictProfiles: Partial<Record<GiftProfile, string[]>> = {
    father: ["parlante", "audifono", "auricular", "reloj", "smartwatch", "cargador", "herramienta", "linterna", "auto", "mouse"],
    gamer: ["mouse", "teclado", "audifono", "auricular", "headset", "pad", "rgb", "parlante", "silla"],
  };

  return strictProfiles[profile] ?? [];
}

export function getGiftAvoidTerms(profile: GiftProfile) {
  const strictAvoid: Partial<Record<GiftProfile, string[]>> = {
    father: ["cocina", "hogar", "decoracion", "belleza", "infantil"],
    gamer: ["cocina", "hogar", "cable generico", "accesorios de celular", "celular", "cocina", "hogar"],
  };

  return strictAvoid[profile] ?? [];
}

export const FATHER_ALLOWED = [
  "parlante",
  "audifono",
  "auricular",
  "headset",
  "reloj",
  "smartwatch",
  "cargador",
  "linterna",
  "herramienta",
  "auto",
  "carro",
  "mouse",
  "teclado",
  "power bank",
  "powerbank",
];

export const FATHER_BLOCKED = [
  "cocina",
  "olla",
  "sarten",
  "licuadora",
  "hogar",
  "decoracion",
  "belleza",
  "maquillaje",
  "infantil",
  "juguete",
];

export function productGiftText(product: {
  name: string;
  code?: string | null;
  category?: string | null;
  description?: string | null;
}) {
  return [
    product.name,
    product.code,
    product.category,
    product.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function isFatherGiftProduct(product: {
  name: string;
  code?: string | null;
  category?: string | null;
  description?: string | null;
}) {
  const text = productGiftText(product);

  const blocked = FATHER_BLOCKED.some((word) => text.includes(word));
  if (blocked) return false;

  return FATHER_ALLOWED.some((word) => text.includes(word));
}
