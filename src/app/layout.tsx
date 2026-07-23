import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.scss";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.rothamelrepuestos.com.ar"),
  title: "Rothamel Repuestos | Repuestos para vehículos pesados",
  description:
    "Soluciones en repuestos para camiones y vehículos pesados con servicio profesional e información actualizada en Resistencia, Chaco.",
  icons: {
    icon: [
      { url: "/logos/alt-logo-white.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
    ],
  },
  openGraph: {
    title: "Rothamel Repuestos | Repuestos para vehículos pesados",
    description:
      "Soluciones en repuestos para camiones y vehículos pesados con servicio profesional e información actualizada en Resistencia, Chaco.",
    url: "https://www.rothamelrepuestos.com.ar",
    siteName: "Rothamel Repuestos",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rothamel Repuestos | Repuestos para vehículos pesados",
    description:
      "Soluciones en repuestos para camiones y vehículos pesados con servicio profesional e información actualizada en Resistencia, Chaco.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
