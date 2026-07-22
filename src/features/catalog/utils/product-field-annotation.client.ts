import type { ProductFieldAnnotationDisplay } from "@/server/services/product-field-annotation.utils";
import {
  postJson,
  uploadFileToSignedTarget,
} from "@/features/catalog/utils/direct-storage-upload";

export type ProductFieldAnnotation = ProductFieldAnnotationDisplay;

type PendingUploadIntent = {
  upload: {
    bucket: string;
    path: string;
    token: string;
    contentType: string;
    originalFilename: string;
  };
};

export async function uploadProductFieldHelpImage(
  productId: string,
  columnInternalKey: string,
  file: File,
  altText?: string | null,
): Promise<
  | {
      success: true;
      data: {
        columnInternalKey: string;
        helpText: string | null;
        thumbnailUrl: string | null;
        fullUrl: string | null;
      };
    }
  | { success: false; error: string; code?: string }
> {
  const encodedKey = encodeURIComponent(columnInternalKey);

  const intent = await postJson<PendingUploadIntent>(
    `/api/admin/products/${productId}/fields/${encodedKey}/help-image/upload-intent`,
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
          : "No se pudo subir la imagen del campo.",
    };
  }

  const finalized = await postJson<{
    annotation: {
      columnInternalKey: string;
      helpText: string | null;
      thumbnailUrl: string | null;
      fullUrl: string | null;
    };
  }>(
    `/api/admin/products/${productId}/fields/${encodedKey}/help-image/finalize-upload`,
    {
      stagingPath: intent.data.upload.path,
      originalFilename: file.name,
      altText: altText ?? undefined,
    },
  );

  if (!finalized.ok || !finalized.data.annotation) {
    return {
      success: false,
      error: finalized.ok
        ? "Respuesta inválida del servidor."
        : finalized.error,
      code: finalized.ok ? undefined : finalized.code,
    };
  }

  return { success: true, data: finalized.data.annotation };
}

export async function deleteProductFieldHelpImage(
  productId: string,
  columnInternalKey: string,
): Promise<{ success: true } | { success: false; error: string; code?: string }> {
  const response = await fetch(
    `/api/admin/products/${productId}/fields/${encodeURIComponent(columnInternalKey)}/help-image`,
    { method: "DELETE" },
  );

  const body = (await response.json().catch(() => null)) as
    | { error?: string; code?: string }
    | null;

  if (!response.ok) {
    return {
      success: false,
      error: body?.error ?? "No se pudo eliminar la imagen del campo.",
      code: body?.code,
    };
  }

  return { success: true };
}
