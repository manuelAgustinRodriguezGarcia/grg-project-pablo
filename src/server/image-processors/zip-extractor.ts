import unzipper from "unzipper";
import { getFileExtension } from "@/server/storage/sanitize-filename";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export const MAX_ZIP_ENTRIES = 500;
export const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
export const MAX_ENTRY_BYTES = 10 * 1024 * 1024;

export type ExtractedZipImage = {
  entryPath: string;
  buffer: Buffer;
  originalName: string;
};

export class ZipExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipExtractionError";
  }
}

export function isSafeZipEntryPath(entryPath: string): boolean {
  const normalized = entryPath.replace(/\\/g, "/").trim();

  if (!normalized || normalized.includes("..") || normalized.startsWith("/")) {
    return false;
  }

  const basename = normalized.split("/").pop() ?? "";
  const extension = getFileExtension(basename);

  return ALLOWED_EXTENSIONS.has(extension);
}

export async function extractImagesFromZip(
  buffer: Buffer,
): Promise<ExtractedZipImage[]> {
  const directory = await unzipper.Open.buffer(buffer);
  const results: ExtractedZipImage[] = [];
  let totalUncompressedBytes = 0;
  let processedEntries = 0;

  for (const file of directory.files) {
    if (file.type === "Directory") {
      continue;
    }

    if (!isSafeZipEntryPath(file.path)) {
      continue;
    }

    processedEntries += 1;
    if (processedEntries > MAX_ZIP_ENTRIES) {
      throw new ZipExtractionError(
        `El ZIP supera el máximo de ${MAX_ZIP_ENTRIES} imágenes.`,
      );
    }

    const uncompressedSize = file.uncompressedSize ?? 0;
    if (uncompressedSize > MAX_ENTRY_BYTES) {
      throw new ZipExtractionError(
        `La entrada "${file.path}" supera el tamaño máximo permitido por imagen.`,
      );
    }

    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new ZipExtractionError(
        "El contenido descomprimido del ZIP supera el límite permitido.",
      );
    }

    const content = await file.buffer();
    if (content.byteLength === 0) {
      continue;
    }

    if (content.byteLength > MAX_ENTRY_BYTES) {
      throw new ZipExtractionError(
        `La entrada "${file.path}" supera el tamaño máximo permitido por imagen.`,
      );
    }

    results.push({
      entryPath: file.path,
      buffer: content,
      originalName: file.path.split("/").pop() ?? file.path,
    });
  }

  return results;
}
