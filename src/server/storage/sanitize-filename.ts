import { StorageValidationError } from "./errors";

const MAX_FILENAME_LENGTH = 200;

/**
 * Strips combining marks so accented letters become ASCII (ñ→n, á→a).
 * Supabase Storage rejects non-ASCII object keys.
 */
function foldDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

/**
 * Elimina componentes de ruta, normaliza a ASCII seguro para Storage
 * y reemplaza caracteres inseguros. El nombre original de negocio
 * (matching de imágenes, UI) debe guardarse aparte, sin pasar por aquí.
 */
export function sanitizeFilename(originalName: string): string {
  const base = originalName.split(/[/\\]/).pop() ?? "";
  const normalized = foldDiacritics(base).trim();

  if (!normalized || normalized === "." || normalized === "..") {
    throw new StorageValidationError("Nombre de archivo inválido.");
  }

  const lastDot = normalized.lastIndexOf(".");
  const namePart = lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
  const extPart = lastDot > 0 ? normalized.slice(lastDot) : "";

  const safeName = namePart
    .replace(/[^\w.\- ]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, Math.max(1, MAX_FILENAME_LENGTH - extPart.length));

  const safeExt = extPart.toLowerCase().replace(/[^\w.]/g, "").slice(0, 20);

  const result = `${safeName}${safeExt}`;

  if (!result || result === safeExt) {
    throw new StorageValidationError("Nombre de archivo inválido.");
  }

  return result;
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) {
    return "";
  }
  return filename.slice(lastDot).toLowerCase();
}
