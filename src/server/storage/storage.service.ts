import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import {
  BUCKET_CONFIGS,
  DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
} from "./config";
import { StorageError } from "./errors";
import { sanitizeFilename } from "./sanitize-filename";
import { getSupabaseAdminClient } from "./supabase-admin";
import type {
  SignedUrlResult,
  StorageBucketName,
  UploadFileInput,
  UploadFileResult,
} from "./types";
import { normalizeStoragePath, validateUpload } from "./validate";

export async function uploadFile(
  input: UploadFileInput,
): Promise<UploadFileResult> {
  const path = normalizeStoragePath(input.path);
  const body = Buffer.isBuffer(input.body)
    ? input.body
    : Buffer.from(
        input.body instanceof ArrayBuffer
          ? new Uint8Array(input.body)
          : input.body,
      );

  validateUpload(
    input.bucket,
    body,
    input.contentType,
    input.originalFilename,
  );

  const client = getSupabaseAdminClient();
  const { error } = await client.storage.from(input.bucket).upload(path, body, {
    contentType: input.contentType,
    upsert: input.upsert ?? false,
  });

  if (error) {
    throw new StorageError(`Error al subir archivo: ${error.message}`);
  }

  const result = {
    bucket: input.bucket,
    path,
    sizeBytes: body.byteLength,
    contentType: input.contentType,
  };

  if (input.auditContext) {
    auditService.logOperationSafe({
      userId: input.auditContext.userId,
      action: AUDIT_ACTIONS.FILE_UPLOADED,
      entityType: AUDIT_ENTITY_TYPES.STORAGE_FILE,
      entityId: `${input.bucket}/${path}`,
    });
  }

  return result;
}

export async function createSignedDownloadUrl(
  bucket: StorageBucketName,
  path: string,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
): Promise<SignedUrlResult> {
  const normalizedPath = normalizeStoragePath(path);
  const client = getSupabaseAdminClient();

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(normalizedPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new StorageError(
      `Error al generar URL firmada: ${error?.message ?? "respuesta vacía"}`,
    );
  }

  return {
    bucket,
    path: normalizedPath,
    signedUrl: data.signedUrl,
    expiresInSeconds,
  };
}

export async function downloadFile(
  bucket: StorageBucketName,
  path: string,
): Promise<Buffer> {
  const normalizedPath = normalizeStoragePath(path);
  const client = getSupabaseAdminClient();

  const { data, error } = await client.storage
    .from(bucket)
    .download(normalizedPath);

  if (error || !data) {
    throw new StorageError(
      `Error al descargar archivo: ${error?.message ?? "respuesta vacía"}`,
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteFile(
  bucket: StorageBucketName,
  path: string,
): Promise<void> {
  const normalizedPath = normalizeStoragePath(path);
  const client = getSupabaseAdminClient();

  const { error } = await client.storage
    .from(bucket)
    .remove([normalizedPath]);

  if (error) {
    throw new StorageError(`Error al eliminar archivo: ${error.message}`);
  }
}

export function buildStoragePath(
  prefix: string,
  originalFilename: string,
  uniqueId?: string,
): string {
  const safePrefix = normalizeStoragePath(prefix);
  const safeName = sanitizeFilename(originalFilename);
  const id = uniqueId?.replace(/[^\w-]/g, "") ?? crypto.randomUUID();

  return `${safePrefix}/${id}-${safeName}`;
}

export async function ensureStorageBuckets(): Promise<void> {
  const client = getSupabaseAdminClient();

  for (const config of Object.values(BUCKET_CONFIGS)) {
    const { data: existing, error: getError } = await client.storage.getBucket(
      config.name,
    );

    if (existing && !getError) {
      continue;
    }

    const { error: createError } = await client.storage.createBucket(
      config.name,
      {
        public: config.public,
      },
    );

    if (createError && !createError.message.includes("already exists")) {
      throw new StorageError(
        `No se pudo crear el bucket "${config.name}": ${createError.message}`,
      );
    }
  }
}

export async function listStorageBuckets(): Promise<string[]> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.storage.listBuckets();

  if (error) {
    throw new StorageError(`Error al listar buckets: ${error.message}`);
  }

  return (data ?? []).map((bucket) => bucket.name);
}
