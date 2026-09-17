import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

export async function loadRothamelLogoPng(): Promise<Uint8Array | null> {
  try {
    const svgPath = path.join(process.cwd(), "public/logos/logo-blue.svg");
    const svg = await fs.readFile(svgPath);
    return await sharp(svg, { density: 180 })
      .resize({ width: 640 })
      .png()
      .toBuffer();
  } catch (error) {
    console.error("[billingPdf] No se pudo rasterizar el logo Rothamel:", error);
    return null;
  }
}
