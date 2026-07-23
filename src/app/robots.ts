import type { MetadataRoute } from "next";
import { SITE_URL } from "@/shared/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/auth/", "/api/", "/login"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: "www.rothamelrepuestos.com.ar",
  };
}
