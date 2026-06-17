import { StorageValidationError } from "./errors";

const MAX_FILENAME_LENGTH = 200;

/**
 * Elimina componentes de ruta, normaliza Unicode y reemplaza caracteres inseguros.
 * Conserva letras (incl. acentos), dígitos, guiones y puntos en el nombre base.
 */
export function sanitizeFilename(originalName: string): string {
  const base = originalName.split(/[/\\]/).pop() ?? "";
  const normalized = base.normalize("NFC").trim();

  if (!normalized || normalized === "." || normalized === "..") {
    throw new StorageValidationError("Nombre de archivo inválido.");
  }

  const lastDot = normalized.lastIndexOf(".");
  const namePart = lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
  const extPart = lastDot > 0 ? normalized.slice(lastDot) : "";

  const safeName = namePart
    .replace(/[^\w.\- áéíóúñÁÉÍÓÚÑüÜ]/g, "_")
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
