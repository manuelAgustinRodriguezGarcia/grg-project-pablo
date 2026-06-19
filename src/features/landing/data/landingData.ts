export type Brand = {
  name: string;
  logoSrc?: string;
};

export const HERO_IMAGE_SRC = "/images/rothamel-hero.webp";

export const PHONE_DISPLAY = "364 458-0297";
export const PHONE_TEL = "+543644580297";
export const WHATSAPP_DISPLAY = "+54 9 364 458-0297";
export const WHATSAPP_URL = "https://wa.me/5493644580297";

export const LOGIN_PATH = "/auth/login";

export const BRANDS: Brand[] = [
  { name: "Scania" },
  { name: "Ford" },
  { name: "Mahle" },
  { name: "Eaton" },
  { name: "Wabco" },
  { name: "Sachs" },
  { name: "Victor Reinz" },
  { name: "Fleetguard" },
  { name: "Mercedes-Benz" },
  { name: "Iveco" },
  { name: "Volvo" },
  { name: "Valeo" },
];

export const MAP_LOCATION = {
  name: "Rothamel Repuestos",
  address: "Acceso Este, H3708",
  city: "Pampa del Infierno, Chaco",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Rothamel%20Repuestos%20Acceso%20Este%20H3708%20Pampa%20del%20Infierno%20Chaco",
  embedSrc:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d24485.28425100998!2d-61.167372797924116!3d-26.50887216462281!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94409a5bdb0cdf15%3A0x8bd56f5154254bc9!2sRothamel%20Repuestos!5e0!3m2!1ses-419!2sar!4v1781825027721!5m2!1ses-419!2sar",
} as const;
