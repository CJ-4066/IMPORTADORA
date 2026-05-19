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

function getSecondSundayOfMay(year: number) {
  const date = new Date(year, 4, 1);
  let sundayCount = 0;

  while (date.getMonth() === 4) {
    if (date.getDay() === 0) {
      sundayCount += 1;
      if (sundayCount === 2) return new Date(date);
    }
    date.setDate(date.getDate() + 1);
  }

  return new Date(year, 4, 14);
}

function getThirdSundayOfJune(year: number) {
  const date = new Date(year, 5, 1);
  let sundayCount = 0;

  while (date.getMonth() === 5) {
    if (date.getDay() === 0) {
      sundayCount += 1;
      if (sundayCount === 3) return new Date(date);
    }
    date.setDate(date.getDate() + 1);
  }

  return new Date(year, 5, 21);
}

function daysBetween(a: Date, b: Date) {
  const oneDay = 1000 * 60 * 60 * 24;
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end.getTime() - start.getTime()) / oneDay);
}

function isNearDate(today: Date, target: Date, beforeDays = 35, afterDays = 3) {
  const diff = daysBetween(today, target);
  return diff >= -afterDays && diff <= beforeDays;
}

export function detectGiftSeason(message: string, now = new Date()): GiftSeason {
  const text = normalizeText(message);
  const year = now.getFullYear();

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

  if (
    text.includes("dia del niño") ||
    text.includes("dia del nino") ||
    text.includes("nino") ||
    text.includes("niño")
  ) {
    return "childrens_day";
  }

  const christmas = new Date(year, 11, 25);
  const mothersDay = getSecondSundayOfMay(year);
  const fathersDay = getThirdSundayOfJune(year);
  const valentines = new Date(year, 1, 14);

  if (isNearDate(now, christmas, 45, 5)) return "christmas";
  if (isNearDate(now, mothersDay, 35, 5)) return "mothers_day";
  if (isNearDate(now, fathersDay, 35, 5)) return "fathers_day";
  if (isNearDate(now, valentines, 25, 3)) return "valentines";

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

export function detectGiftIntent(message: string, now = new Date()): GiftIntentResult {
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
  const season = hasGiftSignal ? detectGiftSeason(message, now) : "none";
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
