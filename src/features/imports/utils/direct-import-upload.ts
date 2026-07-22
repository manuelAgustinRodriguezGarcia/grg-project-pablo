import { createSupabaseBrowserClient } from "@/server/auth/supabase-browser";
import {
  hasExternalImages,
  type ExternalImageSelection,
} from "./external-images";

export type DirectUploadTarget = {
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
  originalFilename: string;
  contentType: string;
  isZip?: boolean;
};

type BeginDirectUploadResponse = {
  jobId: string;
  uploadedFileId: string;
  excel: DirectUploadTarget;
  externals: DirectUploadTarget[];
};

function readErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  return fallback;
}

function selectionToExternalMetas(selection: ExternalImageSelection) {
  const externals: Array<{
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
    isZip: boolean;
  }> = [];

  if (selection.zipFile) {
    externals.push({
      originalFilename: selection.zipFile.name,
      contentType: selection.zipFile.type || "application/zip",
      sizeBytes: selection.zipFile.size,
      isZip: true,
    });
  }

  for (const image of selection.imageFiles) {
    externals.push({
      originalFilename: image.name,
      contentType: image.type || "image/jpeg",
      sizeBytes: image.size,
      isZip: false,
    });
  }

  return externals;
}

async function uploadTargetToStorage(
  target: DirectUploadTarget,
  file: File,
): Promise<void> {
  const client = createSupabaseBrowserClient();
  const { error } = await client.storage
    .from(target.bucket)
    .uploadToSignedUrl(target.path, target.token, file, {
      contentType: target.contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(
      error.message || `No se pudo subir ${target.originalFilename} a Storage.`,
    );
  }
}

function resolveExternalFile(
  target: DirectUploadTarget,
  selection: ExternalImageSelection,
): File {
  if (target.isZip) {
    if (!selection.zipFile) {
      throw new Error("Falta el archivo ZIP de imágenes.");
    }
    return selection.zipFile;
  }

  const image = selection.imageFiles.find(
    (entry) => entry.name === target.originalFilename,
  );
  if (!image) {
    throw new Error(`Falta la imagen ${target.originalFilename}.`);
  }
  return image;
}

/**
 * Uploads Excel (+ optional external images) directly to Supabase Storage,
 * bypassing Vercel's 4.5MB function body limit. Wizard UX is unchanged.
 */
export async function uploadImportViaDirectStorage(input: {
  excelFile: File;
  externalImages?: ExternalImageSelection;
}): Promise<{ jobId: string; uploadedFileId: string }> {
  const externalsMeta = input.externalImages
    ? selectionToExternalMetas(input.externalImages)
    : [];

  const intentResponse = await fetch("/api/admin/imports/upload-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      excel: {
        originalFilename: input.excelFile.name,
        contentType: input.excelFile.type || "application/octet-stream",
        sizeBytes: input.excelFile.size,
      },
      externals: externalsMeta,
    }),
  });

  if (!intentResponse.ok) {
    const payload = await intentResponse.json().catch(() => null);
    throw new Error(readErrorMessage(payload, "No se pudo preparar la subida."));
  }

  const intent = (await intentResponse.json()) as BeginDirectUploadResponse;

  await uploadTargetToStorage(intent.excel, input.excelFile);

  const finalizedExternals: Array<{
    path: string;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
    isZip: boolean;
  }> = [];

  for (const target of intent.externals) {
    if (!input.externalImages) {
      throw new Error(`Falta el archivo ${target.originalFilename}.`);
    }
    const file = resolveExternalFile(target, input.externalImages);
    await uploadTargetToStorage(target, file);
    finalizedExternals.push({
      path: target.path,
      originalFilename: target.originalFilename,
      contentType: target.contentType,
      sizeBytes: file.size,
      isZip: Boolean(target.isZip),
    });
  }

  const finalizeResponse = await fetch(
    `/api/admin/imports/${intent.jobId}/finalize-upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externals: finalizedExternals }),
    },
  );

  if (!finalizeResponse.ok) {
    const payload = await finalizeResponse.json().catch(() => null);
    throw new Error(
      readErrorMessage(payload, "No se pudo finalizar la subida del archivo."),
    );
  }

  return { jobId: intent.jobId, uploadedFileId: intent.uploadedFileId };
}

/**
 * Direct-upload path for attaching external images after the Excel job exists.
 */
export async function uploadExternalImagesToJobDirect(
  jobId: string,
  selection: ExternalImageSelection,
): Promise<void> {
  if (!hasExternalImages(selection)) {
    return;
  }

  const externalsMeta = selectionToExternalMetas(selection);

  const intentResponse = await fetch(
    `/api/admin/imports/${jobId}/images/upload-intent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externals: externalsMeta }),
    },
  );

  if (!intentResponse.ok) {
    const payload = await intentResponse.json().catch(() => null);
    throw new Error(
      readErrorMessage(payload, "No se pudieron preparar las imágenes externas."),
    );
  }

  const intent = (await intentResponse.json()) as {
    jobId: string;
    externals: DirectUploadTarget[];
  };

  const finalizedExternals: Array<{
    path: string;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
    isZip: boolean;
  }> = [];

  for (const target of intent.externals) {
    const file = resolveExternalFile(target, selection);
    await uploadTargetToStorage(target, file);
    finalizedExternals.push({
      path: target.path,
      originalFilename: target.originalFilename,
      contentType: target.contentType,
      sizeBytes: file.size,
      isZip: Boolean(target.isZip),
    });
  }

  const finalizeResponse = await fetch(
    `/api/admin/imports/${jobId}/images/finalize-upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externals: finalizedExternals }),
    },
  );

  if (!finalizeResponse.ok) {
    const payload = await finalizeResponse.json().catch(() => null);
    throw new Error(
      readErrorMessage(payload, "No se pudieron subir las imágenes externas."),
    );
  }
}
