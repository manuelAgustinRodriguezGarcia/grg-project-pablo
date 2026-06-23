export type ImageValidationResult =
  | { valid: true; mimeType: string; format: string }
  | { valid: false; error: string };

export function validateImageMagicBytes(buffer: Buffer): ImageValidationResult {
  if (buffer.length < 3) {
    return { valid: false, error: "Imagen dañada o inválida." };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: "image/jpeg", format: "jpeg" };
  }

  if (buffer.length < 8) {
    return { valid: false, error: "Imagen dañada o inválida." };
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { valid: true, mimeType: "image/png", format: "png" };
  }

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, mimeType: "image/webp", format: "webp" };
  }

  return { valid: false, error: "Formato no soportado." };
}

export function isSharpLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("sharp") ||
    message.includes("DLOPEN") ||
    message.includes("external module")
  );
}
