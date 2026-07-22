import { getFileExtension, sanitizeFilename } from "@/server/storage/sanitize-filename";
import {
  buildStoragePath,
  createSignedUploadUrl,
  deleteFile,
  downloadFile,
  storageObjectExists,
} from "@/server/storage";
import type { SignedUploadUrlResult } from "@/server/storage/types";
import { STORAGE_BUCKETS } from "@/server/storage/types";
import { StorageError } from "@/server/storage/errors";

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const PENDING_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

export type PendingImageUploadTarget = SignedUploadUrlResult & {
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
};

export function resolveImageUploadContentType(
  originalFilename: string,
  reportedType: string,
): string {
  const fromExt = IMAGE_MIME_BY_EXT[getFileExtension(originalFilename)];
  if (fromExt) {
    return fromExt;
  }

  const normalized = reportedType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalized.startsWith("image/")) {
    return normalized;
  }

  return "image/jpeg";
}

export function assertPendingImageMeta(input: {
  originalFilename: string;
  sizeBytes: number;
  maxSizeBytes: number;
}): void {
  const extension = getFileExtension(input.originalFilename);
  if (
    !extension ||
    !PENDING_IMAGE_EXTENSIONS.includes(
      extension as (typeof PENDING_IMAGE_EXTENSIONS)[number],
    )
  ) {
    throw new StorageError("Formato de imagen no permitido. Use JPG, PNG o WebP.");
  }

  if (input.sizeBytes <= 0 || input.sizeBytes > input.maxSizeBytes) {
    throw new StorageError("La imagen supera el tamaño máximo permitido.");
  }
}

/**
 * Mints a signed upload into temp-imports staging. Finalize downloads the
 * object and runs the existing service upload path (thumbnails + DB).
 */
export async function beginPendingImageUpload(input: {
  scope: string;
  ownerId: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  maxSizeBytes: number;
}): Promise<PendingImageUploadTarget> {
  assertPendingImageMeta({
    originalFilename: input.originalFilename,
    sizeBytes: input.sizeBytes,
    maxSizeBytes: input.maxSizeBytes,
  });

  const contentType = resolveImageUploadContentType(
    input.originalFilename,
    input.contentType,
  );
  const safeOwner = sanitizeFilename(input.ownerId).replace(/[^\w-]/g, "") || "owner";
  const stagingPath = buildStoragePath(
    `pending/${input.scope}/${safeOwner}`,
    input.originalFilename,
  );

  const signed = await createSignedUploadUrl(
    STORAGE_BUCKETS.TEMP_IMPORTS,
    stagingPath,
  );

  return {
    ...signed,
    originalFilename: input.originalFilename,
    contentType,
    sizeBytes: input.sizeBytes,
  };
}

export async function downloadPendingImageUpload(
  stagingPath: string,
): Promise<Buffer> {
  if (!stagingPath.startsWith("pending/")) {
    throw new StorageError("Ruta de staging inválida.");
  }

  const exists = await storageObjectExists(
    STORAGE_BUCKETS.TEMP_IMPORTS,
    stagingPath,
  );
  if (!exists) {
    throw new StorageError(
      "La imagen aún no está disponible en Storage. Intente subir de nuevo.",
    );
  }

  return downloadFile(STORAGE_BUCKETS.TEMP_IMPORTS, stagingPath);
}

export async function deletePendingImageUploadBestEffort(
  stagingPath: string,
): Promise<void> {
  try {
    await deleteFile(STORAGE_BUCKETS.TEMP_IMPORTS, stagingPath);
  } catch {
    // best effort
  }
}
