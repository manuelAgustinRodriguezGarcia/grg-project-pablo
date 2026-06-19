import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.scss";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rothamel Repuestos | Repuestos para vehículos pesados",
  description:
    "Soluciones en repuestos para camiones y vehículos pesados con servicio profesional e información actualizada en Resistencia, Chaco.",
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
