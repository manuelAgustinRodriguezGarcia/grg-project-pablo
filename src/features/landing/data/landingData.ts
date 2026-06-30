export type Brand = {
  name: string;
  logoSrc?: string;
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

export const EMAIL_DISPLAY = "pablorothamel@hotmail.com";
export const EMAIL_MAILTO = `mailto:${EMAIL_DISPLAY}`;

export const LOGIN_PATH = "/auth/login";

export type BrandCarouselRow = {
  id: string;
  brands: readonly Brand[];
};

const CAMIONES_MOTORES_BRANDS: readonly Brand[] = [
  { name: "Iveco", logoSrc: marcaLogo("IVECO.svg") },
  { name: "Ford", logoSrc: marcaLogo("FORD.svg") },
  { name: "Volkswagen", logoSrc: marcaLogo("Volkswagen.svg") },
  { name: "Mercedes Benz", logoSrc: marcaLogo("MERCEDES.svg") },
  { name: "Scania", logoSrc: marcaLogo("SCANIA.svg") },
  { name: "Cummins", logoSrc: marcaLogo("Cummins.svg") },
];

const TRACTORES_AGRICOLAS_BRANDS: readonly Brand[] = [
  { name: "Zanello", logoSrc: marcaLogo("zanello.svg") },
  { name: "Pauny", logoSrc: marcaLogo("pauny.svg") },
  { name: "Massey Ferguson", logoSrc: marcaLogo("Massey.svg") },
  { name: "Fiat", logoSrc: marcaLogo("Fiat.svg") },
  { name: "Deutz", logoSrc: marcaLogo("deutz.svg") },
];

function interleaveBrands(
  ...groups: readonly (readonly Brand[])[]
): Brand[] {
  const maxLength = Math.max(...groups.map((group) => group.length));
  const result: Brand[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    for (const group of groups) {
      const brand = group[index];
      if (brand) {
        result.push(brand);
      }
    }
  }

  return result;
}

const VEHICULOS_BRANDS = interleaveBrands(
  CAMIONES_MOTORES_BRANDS,
  TRACTORES_AGRICOLAS_BRANDS,
);

const MARCAS_REPUESTOS_BRANDS: readonly Brand[] = [
  { name: "Indiel", logoSrc: marcaLogo("indiel.jpg") },
  { name: "Exintrader", logoSrc: marcaLogo("exintrader.png") },
  { name: "Baiml", logoSrc: marcaLogo("BAIML.svg") },
  { name: "Mahle", logoSrc: marcaLogo("MAHLE.svg") },
  { name: "Bosch", logoSrc: marcaLogo("BOSCH.svg") },
  { name: "Hasting", logoSrc: marcaLogo("hasting.png") },
  { name: "SKF", logoSrc: marcaLogo("SFK.svg") },
  { name: "Timken", logoSrc: marcaLogo("TIMKEN.svg") },
  { name: "RSK Rodamientos", logoSrc: marcaLogo("RSK.svg") },
  { name: "SAV Retenes", logoSrc: marcaLogo("SAV-RETENES.svg") },
  { name: "Etma Crucetas", logoSrc: marcaLogo("ETMA.svg") },
  { name: "THE Crapodinas", logoSrc: marcaLogo("THE-crapodinas.jpg") },
  { name: "Dayco", logoSrc: marcaLogo("dayco-3.svg") },
  { name: "RG Frenos", logoSrc: marcaLogo("RG-FRENOS.svg") },
  { name: "Tecnofricción", logoSrc: marcaLogo("tecnofriccion.png") },
  { name: "Wabco", logoSrc: marcaLogo("WABCO.svg") },
  { name: "Trucktec", logoSrc: marcaLogo("TRUCKTEC.svg") },
  { name: "Tifec", logoSrc: marcaLogo("TIFEC.png") },
  { name: "Euroricambi", logoSrc: marcaLogo("EURORICAMBI.webp") },
  { name: "FLRS Embragues", logoSrc: marcaLogo("FLRS-EMBRAGUES.jpg") },
  { name: "Iarmetal", logoSrc: marcaLogo("IAR-METAL.jpeg") },
  { name: "Sachs", logoSrc: marcaLogo("sachs.jpg") },
  { name: "VMG", logoSrc: marcaLogo("VMG.png") },
  { name: "Juntas Pampa", logoSrc: marcaLogo("JUNTAS-PAMPA.png") },
  { name: "Correas ABIX", logoSrc: marcaLogo("ABIX.jpeg") },
  { name: "Kobla", logoSrc: marcaLogo("KOBLA.png") },
  {
    name: "Establecimiento Metalúrgico San Francisco",
    logoSrc: marcaLogo("METALURGICO-SAN-FRANCISCO.png"),
  },
  { name: "Wheel Componentes de Acoplados", logoSrc: marcaLogo("wheel.png") },
  {
    name: "ED-MA Componentes Cardánicos Agrícolas",
    logoSrc: marcaLogo("ED-MA.png"),
  },
];

export const BRAND_CAROUSEL_ROWS: readonly BrandCarouselRow[] = [
  {
    id: "vehiculos",
    brands: VEHICULOS_BRANDS,
  },
  {
    id: "repuestos",
    brands: MARCAS_REPUESTOS_BRANDS,
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
