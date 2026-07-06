import type { ProductFieldAnnotationDisplay } from "@/server/services/product-field-annotation.utils";

export type ProductFieldAnnotation = ProductFieldAnnotationDisplay;

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
  const formData = new FormData();
  formData.append("file", file);

  if (altText) {
    formData.append("altText", altText);
  }

  const response = await fetch(
    `/api/admin/products/${productId}/fields/${encodeURIComponent(columnInternalKey)}/help-image`,
    {
      method: "POST",
      body: formData,
    },
  );

  const body = (await response.json().catch(() => null)) as
    | {
        annotation?: {
          columnInternalKey: string;
          helpText: string | null;
          thumbnailUrl: string | null;
          fullUrl: string | null;
        };
        error?: string;
        code?: string;
      }
    | null;

  if (!response.ok) {
    return {
      success: false,
      error: body?.error ?? "No se pudo subir la imagen del campo.",
      code: body?.code,
    };
  }

  if (!body?.annotation) {
    return { success: false, error: "Respuesta inválida del servidor." };
  }

  return { success: true, data: body.annotation };
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
