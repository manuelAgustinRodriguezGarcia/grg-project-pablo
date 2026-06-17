import { BUCKET_CONFIGS } from "./config";
import { StorageValidationError } from "./errors";
import { getFileExtension } from "./sanitize-filename";
import type { StorageBucketName } from "./types";

function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function toBuffer(body: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }

  return Buffer.from(body);
}

export function validateUpload(
  bucket: StorageBucketName,
  body: Buffer | Uint8Array | ArrayBuffer,
  contentType: string,
  originalFilename?: string,
): void {
  const config = BUCKET_CONFIGS[bucket];
  const buffer = toBuffer(body);
  const normalizedMime = normalizeContentType(contentType);

  if (buffer.byteLength === 0) {
    throw new StorageValidationError("El archivo está vacío.");
  }

  if (buffer.byteLength > config.maxSizeBytes) {
    const maxMb = Math.round(config.maxSizeBytes / (1024 * 1024));
    throw new StorageValidationError(
      `El archivo supera el límite de ${maxMb} MB para el bucket "${bucket}".`,
    );
  }

  if (!config.allowedMimeTypes.includes(normalizedMime)) {
    throw new StorageValidationError(
      `Tipo MIME no permitido (${normalizedMime}) en el bucket "${bucket}".`,
    );
  }

  if (originalFilename) {
    const extension = getFileExtension(originalFilename);
    if (!extension || !config.allowedExtensions.includes(extension)) {
      throw new StorageValidationError(
        `Extensión no permitida (${extension || "sin extensión"}) en el bucket "${bucket}".`,
      );
    }
  }
}

export function normalizeStoragePath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "").trim();

  if (!normalized || normalized.includes("..")) {
    throw new StorageValidationError("Ruta de almacenamiento inválida.");
  }

  return normalized;
}
