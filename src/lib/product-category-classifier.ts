type ProductCategoryInput = {
  code?: string | null;
  name?: string | null;
};

const CATEGORY = {
  carAccessories: "ACCESORIOS PARA AUTO",
  cellphoneAccessories: "ACCESORIOS PARA CELULARES",
  homeAccessories: "ACCESORIOS PARA EL HOGAR E ILUMINACION",
  personalCareAccessories: "ACCESORIOS DE CUIDADO PERSONAL",
  schoolSupplies: "ARTICULOS ESCOLARES",
  homeAndLighting: "ARTICULOS PARA EL HOGAR E ILUMINACION",
  headphones: "AURICULARES",
  batteries: "BATERIAS",
  wallet: "Billetera",
  securityCamera: "CAMARA DE SEGURIDAD",
  storage: "DISPOSITIVOS DE ALMACENAMIENTO",
  portableDevices: "DISPOSITIVOS PORTATILES",
  multimedia: "ENTRETENIMIENTO Y MULTIMEDIA",
  bags: "EQUIPAJE/BOLSOS",
  adultToys: "JUGUETES SEXUALES",
  toys: "JUGUETES/UTILES ESCOLARES",
  personalCareMachines: "MAQUINA DE CUIDADO PERSONAL",
  news: "NOVEDADES",
  speakers: "PARLANTES",
  peripherals: "PERIFERICOS",
  smartWatch: "SMART WATCH Y SUS ACCESORIOS",
  kitchen: "UTENCILLOS DE COCINA Y ACCESORIOS DE USO DOMESTICO",
} as const;

export function inferStoreCategoryName(input: ProductCategoryInput) {
  const code = normalizeSearchText(input.code ?? "");
  const text = normalizeSearchText(`${input.code ?? ""} ${input.name ?? ""}`);

  if (!text.trim()) {
    return null;
  }

  if (hasAny(text, ["CONSOLADOR", "VIBRADOR", "DILDO", "MASTURBADOR", "JUGUETE SEXUAL"])) {
    return CATEGORY.adultToys;
  }

  if (
    hasAny(text, [
      " JUGT",
      "(JUGT",
      "JUGUETE",
      "JGTE",
      "FISHER",
      "MEGA BLOCK",
      "BLOQUES",
      "SPIDEY",
      "BOWLING",
      "PIZARRA DIDACTICA",
      "PLAY DOOH",
      "SET DE ARTE",
      "CAMARA PARA NINOS",
      "BALON",
      "ASTEROIDES",
      "MECANO",
      "PLANCHITAS DE PLASTICO",
    ])
  ) {
    return CATEGORY.toys;
  }

  if (hasAny(text, ["BILLETERA", "CARTERA", "MONEDERO"])) {
    return CATEGORY.wallet;
  }

  if (
    hasAny(text, [
      "PARA AUTO",
      "PARA CARRO",
      "PARA COCHE",
      "DE COCHE",
      "EN EL AUTO",
      "AUTO ",
      "CAR ",
      "CIGARRERA",
      "CASCO",
      "MOTO",
      "NEUMATIC",
      "COMPRESOR",
      "INFLADOR",
      "HIDRAULICO",
      "INVERSOR DE CORRIENTE",
      "ESPEJO LED TOCADOR PARA AUTO",
      "SOPLADOR DE AIRE",
      "MINI CONGELADOR DE CARRO",
    ])
  ) {
    return CATEGORY.carAccessories;
  }

  if (
    hasAny(text, [
      "CAMARA DE SEGURIDAD",
      "CAMARA IP",
      "WIFI CAMERA",
      "WI-FI CAMERA",
      "OUTDOOR CAMERA",
      "CAMARA XIAOMI",
      "CAMARA PORTATIL",
      "FOCO CAMARA",
      "GRABADORA",
      "LENTE GRAN ANGULAR",
      "SET DE 4 CAMARAS",
      "PANEL SOLAR ET-",
      "NVS009",
      "IPC-",
      "EZVIZ",
      "ICSEE",
      "ICSSE",
      "EWTTO EWT-M",
      "CAMARA 355",
      "CAMARA EWTTO",
    ])
  ) {
    return CATEGORY.securityCamera;
  }

  if (
    hasAny(text, [
      "PARLANTE",
      "ALTAVOZ",
      "SPEAKER",
      "SOUNDBAR",
      "BARRA DE SONIDO",
      "RADIO ",
      "KARAOKE",
      "PARTYBOX",
      "PARTY BOOM",
      "MUSIC SPORT",
      "SOUND OUTDOOR",
      "HARMAN KARDON",
      "TRONSMART PARLANTE",
      "JBL MAX",
      "JBL PRX",
      "JBL EON",
    ])
  ) {
    return CATEGORY.speakers;
  }

  if (
    hasAny(text, [
      "AUDIFONO",
      "AUDIFONOS",
      "AUDIFIONO",
      "AURICULAR",
      "AURICULARES",
      "HEADPHONE",
      "HEADSET",
      "AIRPODS",
      "BUDS",
      "TWS",
      "EARCUFF",
      "VINCHA",
      "ULTRAPODS",
      "BLUETOOTH SUPER",
      "AIR SPORT",
      "SOUNDPEATS",
      "TRONSMART SOUNFII",
      "JBL WAVE",
      "JBL TUNE",
      "JBL SENSE",
      "BASEUS BOWIE",
      "REDMI BUDS",
      "GALAXY BUDS",
      "QCY",
      "SPACE ONE",
      "SUDIO",
    ])
  ) {
    return CATEGORY.headphones;
  }

  if (
    hasAny(text, [
      "MEMORIA USB",
      "USB DATO",
      "USB 2.0 METAL",
      "USB 3.0",
      "PENDRIVE",
      "MICRO SD",
      "TARJETA SD",
      "USB ALDEEPO",
    ])
    || (text.includes("USB") && /\b\d+\s*GB\b/.test(text))
  ) {
    return CATEGORY.storage;
  }

  if (
    hasAny(text, [
      "MAQUINA CORTA PELO",
      "MAQUINA DE AFEITAR",
      "MAQUINA AFEITAR",
      "CORTADORA",
      "TRIMMER",
      "SET KEMEI",
      "KEMEI",
      "AFEITADORA",
      "CORTAR CABELLO",
    ])
  ) {
    return CATEGORY.personalCareMachines;
  }

  if (
    hasAny(text, [
      "SMARTWATCH",
      "SMART WATCH",
      "APPLE WATCH",
      "REDMI WATCH",
      "SMART BAND",
      "RELOJ PULSERA",
      "RELOJ BRAZALETE",
      "CORREA DE SMARTWATCH",
      "CORREA SMARTWATCH",
      "BAND 9",
      "BAND 10",
      "WATCH 5",
    ])
  ) {
    return CATEGORY.smartWatch;
  }

  if (
    hasAny(text, [
      "CELULAR",
      "CELUKAR",
      "SMARTPHONE",
      "IPHONE",
      "REDMI ",
      "HONOR ",
      "GALAXY ",
      "SAMSUNG",
      "MOTO G",
      "TECNO",
      "ZTE ",
      "INFINIX",
      "MEIZU",
      "TABLET",
      "IPAD",
      "BLACKVIEW",
      "KRONO NET",
      "MAGIC 8",
      "NOTE 15",
      "LOGIC L",
    ])
    || code.startsWith("CE")
  ) {
    return CATEGORY.portableDevices;
  }

  if (
    hasAny(text, [
      "POWER BANK",
      "POWERBANK",
      "CARGADOR PORTATIL",
      "BATERIA",
      "PILA ",
      "PILAS",
      "MAH",
      "MHA",
    ])
  ) {
    return CATEGORY.batteries;
  }

  if (
    hasAny(text, [
      "CABLE",
      "CARGADOR",
      "DADO ",
      "ADAPTADOR USB",
      "ADAPTADOR DE ENCHUFE",
      "USB-C",
      "TIPO C",
      "LIGHTNING",
      "HOLDER PARA CELULAR",
      "SOPORTE PARA CELULAR",
      "SOPORTE MAGNETICO",
      "PALO SELFIE",
      "SELFIE STICK",
      "MONOPOD",
      "TRIPODE PARA CELULAR",
      "MINI TRIPODE",
      "ENCHUFE INTELIGENTE",
      "HYPERCHARGE",
      "WIRELESS CHARGER",
      "MAGNETIC WIRELESS CHARGER",
      "NEXODE",
      "FAST CHARGER",
      "ESTACION DE CARGA",
      "HUB CM",
      "USB-C HUB",
      "MULTIFUNCION ADAPTER",
    ])
    || code.startsWith("H")
  ) {
    return CATEGORY.cellphoneAccessories;
  }

  if (
    hasAny(text, [
      "LICUADORA",
      "OLLA",
      "OLLAS",
      "CUCHILLO",
      "CUCHILLOS",
      "HORNO ELECTRICO",
      "MICROONDA",
      "CAFETERA",
      "KETTLE",
      "HERVIDOR",
      "FREIDORA",
      "WAFLERA",
      "TOASTER",
      "RICE COOKER",
      "EXPRESSO",
      "AIR FRYER",
      "COCINA",
      "UTENSILIO",
      "CORTADOR DE VERDURA",
      "ESCURRIDOR",
      "CONDIMENTOS",
      "LONCHERA ELECTRICA",
      "MAQUINA DE HIELO",
      "HACER HIELO",
      "CONGELADOR",
      "YOGGIS",
      "GLASS KETTLE",
      "XIAOMI JUICE",
    ])
  ) {
    return CATEGORY.kitchen;
  }

  if (
    hasAny(text, [
      "ROPA",
      "ROPERO",
      "PERCHERO",
      "ESTANTE",
      "ORGANIZADOR",
      "JOYERO",
      "COJIN",
      "BALANZA",
      "VENTILADOR",
      "PLANCHA VAPOR",
      "PLANCHA ELECTRICA",
      "HIDROLAVADORA",
      "MANGUERA",
      "LINTERNA",
      "PISTOLA DE PINTURA",
      "KIT DE LIMPIEZA",
      "MINI ASPIRADORA",
      "LAMPARA",
      "LAMAPARA",
      "FOCO",
      "REFLECTOR",
      "APLIQUE",
      "LUZ SOLAR",
      "LUZ PARA",
      "HEATER",
      "HUMIDIFIER",
      "PURIFICADOR",
      "ANTOMOSQUITOS",
      "LED MATRIX",
      "WALL BRACKET",
      "TV WALL",
      "CEILING LIGHT",
    ])
  ) {
    return CATEGORY.homeAndLighting;
  }

  if (
    hasAny(text, [
      "PLANCHA ALIZADORA",
      "PLANCHA DE CABELLO",
      "PEINE SECADOR",
      "SECADOR DE CABELLO",
      "SECADORA DE CABELLO",
      "SECADORA DE CABELO",
      "CEPILLO SECADOR",
      "FAJA",
      "PEZONERA",
      "MUNEQUERA",
      "PARCHES PARA DOLOR",
      "CORRECTOR DE POSTURA",
      "SET DE GIMNASIO",
      "MASAJEADOR",
      "PISTOLA MASAJEADOR",
      "NECK BRACE",
    ])
  ) {
    return CATEGORY.personalCareAccessories;
  }

  if (
    hasAny(text, [
      "TV STICK",
      "TV BOX",
      "FIRE TV",
      "SMART TV",
      "TELEVISOR",
      "TV A PRO",
      "PROJECTOR",
      "PROYECTOR",
      "ECRAN",
      "PANTALLA",
      "CONSOLA",
      "GAMEPAD",
      "JOYSTICK",
      "MANDO",
      "MEGA PACK GAMER",
      "VIDEOJUEGO",
      "JUEGO M27",
      "R36S",
      "VR BOX",
      "VIRTUAL REALITY",
      "STREAMING MIXER",
      "MICROFONO",
      "MICROPHONE",
      "ESTABILIZADOR DE VIDEO",
      "CAMARA ACTION",
      "CAMARA DEPORTIVA",
      "CAMARA THERE",
      "DJI ",
      "ADAPTADOR DE TV",
    ])
  ) {
    return CATEGORY.multimedia;
  }

  if (
    hasAny(text, [
      "MOUSE",
      "TECLADO",
      "KEYBOARD",
      "COOLER PARA LAPTOP",
      "COOLES PARA LAPTOP",
      "PAD MOUSE",
      "MOUSE PAD",
      "KIT GAMER",
      "COMBO GAMER",
      "HUB ADAPTADOR",
      "USB 2.0 HUB",
      "ADAPTADOR DE RED",
      "CAMARA WEB",
      "WEB CAM",
      "ESTABILIZADOR ",
      "ROUTER",
      "MESH SYSTEM",
      "SWITCH CUDY",
      "WIFI ROUTER",
      "WI-FI ROUTER",
      "ADAPTADOR CUDY",
      "NANO USB ADAPTER",
      "CONVERTIDOR AV2HDMI",
    ])
    || code.startsWith("PC")
  ) {
    return CATEGORY.peripherals;
  }

  if (code.startsWith("BT") || hasAny(text, ["BLUETOOTH MAGIC", "BOWIE"])) {
    return CATEGORY.headphones;
  }

  if (hasAny(text, ["MOCHILA", "BOLSO", "MALETA", "EQUIPAJE", "CARTUCHERA"])) {
    return CATEGORY.bags;
  }

  if (hasAny(text, ["LAPICERO", "PEN ", "WRITING TABLET", "ESCOLAR", "CUADERNO"])) {
    return CATEGORY.schoolSupplies;
  }

  return CATEGORY.news;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function hasAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(candidate.toUpperCase()));
}
