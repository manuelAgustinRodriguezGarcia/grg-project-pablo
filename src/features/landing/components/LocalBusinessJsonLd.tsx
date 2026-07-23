import {
  EMAIL_DISPLAY,
  LOGO_BLUE_SRC,
  MAP_LOCATION,
  PHONE_TEL,
} from "../data/landingData";
import { SITE_NAME, SITE_OG_IMAGE, SITE_URL } from "@/shared/seo/site";

/**
 * Structured data for the public landing. Server component so crawlers
 * receive JSON-LD without client JS.
 */
export function LocalBusinessJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    name: SITE_NAME,
    url: SITE_URL,
    image: [`${SITE_URL}${SITE_OG_IMAGE}`],
    logo: `${SITE_URL}${LOGO_BLUE_SRC.split("?")[0]}`,
    telephone: PHONE_TEL,
    email: EMAIL_DISPLAY,
    address: {
      "@type": "PostalAddress",
      streetAddress: MAP_LOCATION.address,
      addressLocality: "Pampa del Infierno",
      addressRegion: "Chaco",
      addressCountry: "AR",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
        ],
        opens: "07:30",
        closes: "19:30",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "07:30",
        closes: "12:30",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
