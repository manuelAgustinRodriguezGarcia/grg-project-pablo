import type { ProductTablePrimaryImage } from "@/features/catalog/types/product-table.types";

type ProductImageResponse = {
  id: string;
  thumbnailUrl: string | null;
  fullUrl: string | null;
  error?: string;
  code?: string;
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
  const formData = new FormData();
  formData.append("file", file);

  if (options.isPrimary !== undefined) {
    formData.append("isPrimary", options.isPrimary ? "true" : "false");
  } else {
    formData.append("isPrimary", "true");
  }

  if (options.label) {
    formData.append("label", options.label);
  }

  if (options.sortOrder !== undefined) {
    formData.append("sortOrder", String(options.sortOrder));
  }

  const response = await fetch(`/api/admin/products/${productId}/images`, {
    method: "POST",
    body: formData,
  });

  const body = (await response.json().catch(() => null)) as ProductImageResponse | null;

  if (!response.ok || !body?.id) {
    return {
      success: false,
      error: body?.error ?? "No se pudo subir la imagen del producto.",
      code: body?.code,
    };
  }

  return { success: true, data: mapImageResponse(body) };
}

export async function replaceProductLinkedImage(
  productId: string,
  imageId: string,
  file: File,
): Promise<
  | { success: true; data: ProductTablePrimaryImage }
  | { success: false; error: string; code?: string }
> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `/api/admin/products/${productId}/images/${imageId}`,
    {
      method: "PATCH",
      body: formData,
    },
  );

  const body = (await response.json().catch(() => null)) as ProductImageResponse | null;

  if (!response.ok || !body?.id) {
    return {
      success: false,
      error: body?.error ?? "No se pudo reemplazar la imagen del producto.",
      code: body?.code,
    };
  }

  return { success: true, data: mapImageResponse(body) };
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
