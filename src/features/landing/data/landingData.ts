export type Brand = {
  name: string;
  logoSrc?: string;
  /** Visual scale relative to default track height (1 = normal). */
  logoScale?: number;
};

/** Ruta de logo en /public/marcas (SVG, PNG, JPG, WebP, etc.). */
export const marcaLogo = (filename: string) => `/marcas/${filename}` as const;

/** Incrementar al reemplazar archivos en public/banner/ con el mismo nombre. */
export const HERO_BANNER_VERSION = "20260626";

export const LOGO_BLUE_SRC = "/logos/logo-blue.svg?v=1";
export const LOGO_WHITE_SRC = "/logos/logo-white.svg?v=1";
export const ALT_LOGO_WHITE_SRC = "/logos/alt-logo-white.svg?v=1";
export const LOGO_WIDTH = 2172;
export const LOGO_HEIGHT = 724;

const heroBannerPath = (filename: string) =>
  `/banner/${filename}?v=${HERO_BANNER_VERSION}`;

export const HERO_BANNER_IMAGES = [
  heroBannerPath("banner-1.webp"),
  heroBannerPath("banner-2.webp"),
  heroBannerPath("banner-3.webp"),
  heroBannerPath("banner-4.webp"),
] as const;

export const HERO_BANNER_WIDTH = 750;
export const HERO_BANNER_HEIGHT = 496.36;

export const HERO_IMAGE_SRC = HERO_BANNER_IMAGES[0];

export const PHONE_DISPLAY = "364 458-0297";
export const PHONE_TEL = "+543644580297";
export const WHATSAPP_DISPLAY = "+54 9 364 458-0297";
export const WHATSAPP_URL = "https://wa.me/5493644580297";

export function categoryWhatsAppUrl(categoryTitle: string): string {
  const text = `Hola, quisiera consultar por ${categoryTitle}`;
  return `${WHATSAPP_URL}?text=${encodeURIComponent(text)}`;
}

export const EMAIL_DISPLAY = "rothamelsh@gmail.com";
export const EMAIL_MAILTO = `mailto:${EMAIL_DISPLAY}`;

export const LOGIN_PATH = "/auth/login";

export type BrandCarouselRow = {
  id: string;
  brands: readonly Brand[];
};

const MARCAS_REPUESTOS_BRANDS: readonly Brand[] = [
  { name: "Indiel", logoSrc: marcaLogo("indiel.jpg") },
  { name: "Exintrader", logoSrc: marcaLogo("exintrader.png") },
  { name: "Baiml", logoSrc: marcaLogo("BAIML.svg") },
  { name: "Mahle", logoSrc: marcaLogo("MAHLE.svg") },
  { name: "Bosch", logoSrc: marcaLogo("BOSCH.svg") },
  { name: "Hasting", logoSrc: marcaLogo("hasting.png") },
  { name: "SKF", logoSrc: marcaLogo("SFK.svg") },
  { name: "Timken", logoSrc: marcaLogo("TIMKEN.svg") },
  { name: "RSK Rodamientos", logoSrc: marcaLogo("RSK.svg"), logoScale: 0.72 },
  { name: "SAV Retenes", logoSrc: marcaLogo("SAV-RETENES.png") },
  { name: "Etma Crucetas", logoSrc: marcaLogo("ETMA.png") },
  { name: "THE Crapodinas", logoSrc: marcaLogo("THE-crapodinas.jpg") },
  { name: "Dayco", logoSrc: marcaLogo("dayco-3.svg") },
  { name: "RG Frenos", logoSrc: marcaLogo("RG-FRENOS.svg"), logoScale: 1.4 },
  { name: "Tecnofricción", logoSrc: marcaLogo("tecnofriccion.png"), logoScale: 1.25 },
  { name: "Wabco", logoSrc: marcaLogo("WABCO.svg") },
  { name: "Trucktec", logoSrc: marcaLogo("TRUCKTEC.svg"), logoScale: 1.3 },
  { name: "Tifec", logoSrc: marcaLogo("TIFEC.png"), logoScale: 1.3 },
  { name: "Euroricambi", logoSrc: marcaLogo("EURORICAMBI.webp") },
  { name: "FLRS Embragues", logoSrc: marcaLogo("FLRS-EMBRAGUES.jpg") },
  { name: "Iarmetal", logoSrc: marcaLogo("IAR-METAL.jpeg") },
  { name: "Sachs", logoSrc: marcaLogo("sachs.jpg") },
  { name: "VMG", logoSrc: marcaLogo("VMG.png"), logoScale: 1.4 },
  { name: "Juntas Pampa", logoSrc: marcaLogo("JUNTAS-PAMPA.png") },
  { name: "Correas ABIX", logoSrc: marcaLogo("ABIX.jpeg"), logoScale: 1.25 },
  { name: "Kobla", logoSrc: marcaLogo("KOBLA.png"), logoScale: 1.3 },
  {
    name: "Establecimiento Metalúrgico San Francisco",
    logoSrc: marcaLogo("METALURGICO-SAN-FRANCISCO.png"),
    logoScale: 1.4,
  },
  { name: "Wheel Componentes de Acoplados", logoSrc: marcaLogo("wheel.png") },
  {
    name: "ED-MA Componentes Cardánicos Agrícolas",
    logoSrc: marcaLogo("ED-MA.png"),
  },
];

export const BRAND_CAROUSEL_ROWS: readonly BrandCarouselRow[] = [
  {
    id: "repuestos",
    brands: MARCAS_REPUESTOS_BRANDS,
  },
];

export type CategoryShowcaseItem = {
  id: string;
  title: string;
  /** Product/category photo from /public/circles. */
  imageSrc: string;
  imageAlt: string;
  /** Smaller product art so more of the ring stays visible. */
  imageFit?: "compact";
};

/** Ruta de imagen de categoría en /public/circles. */
export const circleImage = (filename: string) => `/circles/${filename}` as const;

export const CATEGORY_SHOWCASE_ITEMS: readonly CategoryShowcaseItem[] = [
  {
    id: "circuito-de-aire",
    title: "CIRCUITO DE AIRE",
    imageSrc: circleImage("circuito_de_aire.png"),
    imageAlt: "Circuito de aire",
  },
  {
    id: "encendido",
    title: "ENCENDIDO",
    imageSrc: circleImage("encendido.png"),
    imageAlt: "Encendido",
    imageFit: "compact",
  },
  {
    id: "embragues",
    title: "EMBRAGUES",
    imageSrc: circleImage("embragues.png"),
    imageAlt: "Embragues",
  },
  {
    id: "rodamientos",
    title: "RODAMIENTOS",
    imageSrc: circleImage("rodamientos.png"),
    imageAlt: "Rodamientos",
  },
  {
    id: "partes-de-acoplados",
    title: "PARTES DE ACOPLADOS",
    imageSrc: circleImage("partes_de_acoplado.png"),
    imageAlt: "Partes de acoplados",
  },
  {
    id: "mazas-de-rueda",
    title: "MAZAS DE RUEDA",
    imageSrc: circleImage("mazas_de_rueda.png"),
    imageAlt: "Mazas de rueda",
    imageFit: "compact",
  },
  {
    id: "campanas-de-rueda",
    title: "CAMPANAS DE RUEDA",
    imageSrc: circleImage("campana_de_rueda.png"),
    imageAlt: "Campanas de rueda",
    imageFit: "compact",
  },
  {
    id: "frenos",
    title: "FRENOS",
    imageSrc: circleImage("frenos.png"),
    imageAlt: "Frenos",
  },
  {
    id: "filtros",
    title: "FILTROS",
    imageSrc: circleImage("filtros.png"),
    imageAlt: "Filtros",
  },
  {
    id: "diferencial",
    title: "DIFERENCIAL",
    imageSrc: circleImage("diferencial.png"),
    imageAlt: "Diferencial",
  },
  {
    id: "elasticos-y-manoplas",
    title: "ELÁSTICOS Y MANOPLAS",
    imageSrc: circleImage("elasticos_y_manoplas.png"),
    imageAlt: "Elásticos y manoplas",
  },
  {
    id: "barras-cardanicas",
    title: "BARRAS CARDÁNICAS",
    imageSrc: circleImage("barra_cardanica.png"),
    imageAlt: "Barras cardánicas",
  },
  {
    id: "palieres",
    title: "PALIERES",
    imageSrc: circleImage("palieres.png"),
    imageAlt: "Palieres",
  },
  {
    id: "transmision",
    title: "TRANSMISION",
    imageSrc: circleImage("transmision.png"),
    imageAlt: "Transmisión",
  },
  {
    id: "bombas-de-agua",
    title: "BOMBAS DE AGUA",
    imageSrc: circleImage("bombas_de_agua.png"),
    imageAlt: "Bombas de agua",
  },
];

export const MAP_LOCATION = {
  name: "Rothamel Repuestos",
  address: "Acceso Este",
  city: "Pampa del Infierno, Chaco",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Rothamel%20Repuestos%20Acceso%20Este%20H3708%20Pampa%20del%20Infierno%20Chaco",
  embedSrc:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d24485.28425100998!2d-61.167372797924116!3d-26.50887216462281!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94409a5bdb0cdf15%3A0x8bd56f5154254bc9!2sRothamel%20Repuestos!5e0!3m2!1ses-419!2sar!4v1781825027721!5m2!1ses-419!2sar",
} as const;
