import type { ColumnListItem } from "@/features/catalog/types/column.types";
import {
  postJson,
  uploadFileToSignedTarget,
} from "@/features/catalog/utils/direct-storage-upload";

type ColumnHelpResult =
  | { success: true; data: ColumnListItem }
  | { success: false; error: string; code?: string };

type PendingUploadIntent = {
  upload: {
    bucket: string;
    path: string;
    token: string;
    contentType: string;
    originalFilename: string;
  };
};

export async function uploadColumnHelpImage(
  columnId: string,
  file: File,
  altText?: string | null,
): Promise<ColumnHelpResult> {
  const intent = await postJson<PendingUploadIntent>(
    `/api/admin/columns/${columnId}/help-image/upload-intent`,
    {
      originalFilename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      altText: altText ?? undefined,
    },
  );

  if (!intent.ok) {
    return { success: false, error: intent.error, code: intent.code };
  }

  try {
    await uploadFileToSignedTarget(intent.data.upload, file);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo subir la imagen de ayuda.",
    };
  }

  const finalized = await postJson<{ column: ColumnListItem }>(
    `/api/admin/columns/${columnId}/help-image/finalize-upload`,
    {
      stagingPath: intent.data.upload.path,
      originalFilename: file.name,
      altText: altText ?? undefined,
    },
  );

  if (!finalized.ok || !finalized.data.column) {
    return {
      success: false,
      error: finalized.ok
        ? "Respuesta inválida del servidor."
        : finalized.error,
      code: finalized.ok ? undefined : finalized.code,
    };
  }

  return { success: true, data: finalized.data.column };
}

export async function deleteColumnHelpImage(
  columnId: string,
): Promise<ColumnHelpResult> {
  const response = await fetch(`/api/admin/columns/${columnId}/help-image`, {
    method: "DELETE",
  });

  const body = (await response.json().catch(() => null)) as
    | { column?: ColumnListItem; error?: string; code?: string }
    | null;

  if (!response.ok) {
    return {
      success: false,
      error: body?.error ?? "No se pudo eliminar la imagen de ayuda.",
      code: body?.code,
    };
  }

  if (!body?.column) {
    return { success: false, error: "Respuesta inválida del servidor." };
  }

  return { success: true, data: body.column };
}
