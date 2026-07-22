import type { ProductTablePrimaryImage } from "@/features/catalog/types/product-table.types";
import {
  postJson,
  uploadFileToSignedTarget,
} from "@/features/catalog/utils/direct-storage-upload";

type ProductImageResponse = {
  id: string;
  thumbnailUrl: string | null;
  fullUrl: string | null;
  error?: string;
  code?: string;
};

type PendingUploadIntent = {
  upload: {
    bucket: string;
    path: string;
    token: string;
    contentType: string;
    originalFilename: string;
  };
  meta?: {
    isPrimary?: boolean;
    sortOrder?: number;
    label?: string | null;
  };
};

export type UploadProductLinkedImageOptions = {
  isPrimary?: boolean;
  label?: string;
  sortOrder?: number;
};

function mapImageResponse(
  image: ProductImageResponse,
): ProductTablePrimaryImage {
  return {
    id: image.id,
    thumbnailUrl: image.thumbnailUrl,
    fullUrl: image.fullUrl,
  };
}

export async function uploadProductLinkedImage(
  productId: string,
  file: File,
  options: UploadProductLinkedImageOptions = {},
): Promise<
  | { success: true; data: ProductTablePrimaryImage }
  | { success: false; error: string; code?: string }
> {
  const intent = await postJson<PendingUploadIntent>(
    `/api/admin/products/${productId}/images/upload-intent`,
    {
      originalFilename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      isPrimary: options.isPrimary ?? true,
      label: options.label,
      sortOrder: options.sortOrder,
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
          : "No se pudo subir la imagen del producto.",
    };
  }

  const finalized = await postJson<ProductImageResponse>(
    `/api/admin/products/${productId}/images/finalize-upload`,
    {
      stagingPath: intent.data.upload.path,
      originalFilename: file.name,
      isPrimary: options.isPrimary ?? true,
      label: options.label,
      sortOrder: options.sortOrder,
    },
  );

  if (!finalized.ok || !finalized.data.id) {
    return {
      success: false,
      error: finalized.ok
        ? "No se pudo subir la imagen del producto."
        : finalized.error,
      code: finalized.ok ? undefined : finalized.code,
    };
  }

  return { success: true, data: mapImageResponse(finalized.data) };
}

export async function replaceProductLinkedImage(
  productId: string,
  imageId: string,
  file: File,
): Promise<
  | { success: true; data: ProductTablePrimaryImage }
  | { success: false; error: string; code?: string }
> {
  const intent = await postJson<PendingUploadIntent>(
    `/api/admin/products/${productId}/images/${imageId}/upload-intent`,
    {
      originalFilename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
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
          : "No se pudo reemplazar la imagen del producto.",
    };
  }

  const finalized = await postJson<ProductImageResponse>(
    `/api/admin/products/${productId}/images/${imageId}/finalize-upload`,
    {
      stagingPath: intent.data.upload.path,
      originalFilename: file.name,
    },
  );

  if (!finalized.ok || !finalized.data.id) {
    return {
      success: false,
      error: finalized.ok
        ? "No se pudo reemplazar la imagen del producto."
        : finalized.error,
      code: finalized.ok ? undefined : finalized.code,
    };
  }

  return { success: true, data: mapImageResponse(finalized.data) };
}

export async function deleteProductLinkedImage(
  productId: string,
  imageId: string,
): Promise<{ success: true } | { success: false; error: string; code?: string }> {
  const response = await fetch(
    `/api/admin/products/${productId}/images/${imageId}`,
    { method: "DELETE" },
  );

  const body = (await response.json().catch(() => null)) as
    | { error?: string; code?: string }
    | null;

  if (!response.ok) {
    return {
      success: false,
      error: body?.error ?? "No se pudo eliminar la imagen del producto.",
      code: body?.code,
    };
  }

  return { success: true };
}
