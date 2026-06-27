import type { ColumnListItem } from "@/features/catalog/types/column.types";

type UploadResult =
  | { success: true; data: ColumnListItem }
  | { success: false; error: string; code?: string };

export async function uploadColumnHelpImage(
  columnId: string,
  file: File,
  altText?: string | null,
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  if (altText) {
    formData.append("altText", altText);
  }

  const response = await fetch(`/api/admin/columns/${columnId}/help-image`, {
    method: "POST",
    body: formData,
  });

  const body = (await response.json().catch(() => null)) as
    | { column?: ColumnListItem; error?: string; code?: string }
    | null;

  if (!response.ok) {
    return {
      success: false,
      error: body?.error ?? "No se pudo subir la imagen de ayuda.",
      code: body?.code,
    };
  }

  if (!body?.column) {
    return { success: false, error: "Respuesta inválida del servidor." };
  }

  return { success: true, data: body.column };
}
