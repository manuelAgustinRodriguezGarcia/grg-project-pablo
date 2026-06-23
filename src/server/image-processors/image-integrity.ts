import { isSharpLoadError, validateImageMagicBytes } from "./image-magic-bytes";
import type { ImageValidationResult } from "./image-magic-bytes";
import { loadSharp } from "./load-sharp";

const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type { ImageValidationResult };

export async function validateImageBuffer(
  buffer: Buffer,
): Promise<ImageValidationResult> {
  try {
    const sharp = await loadSharp();
    const metadata = await sharp(buffer).metadata();

    if (!metadata.format || !SUPPORTED_FORMATS.has(metadata.format)) {
      return {
        valid: false,
        error: `Formato no soportado: ${metadata.format ?? "desconocido"}.`,
      };
    }

    await sharp(buffer).rotate().toBuffer();

    const mimeType =
      metadata.format === "jpeg" ? "image/jpeg" : `image/${metadata.format}`;

    return { valid: true, mimeType, format: metadata.format };
  } catch (error) {
    if (isSharpLoadError(error)) {
      return validateImageMagicBytes(buffer);
    }

    return {
      valid: false,
      error: error instanceof Error ? error.message : "Imagen dañada o inválida.",
    };
  }
}
