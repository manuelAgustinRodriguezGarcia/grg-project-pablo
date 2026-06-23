import {
  appendExternalImagesToFormData,
  hasExternalImages,
  type ExternalImageSelection,
} from "./external-images";

export async function uploadExternalImagesToJob(
  jobId: string,
  selection: ExternalImageSelection,
): Promise<void> {
  if (!hasExternalImages(selection)) {
    return;
  }

  const formData = new FormData();
  appendExternalImagesToFormData(formData, selection);

  const response = await fetch(`/api/admin/imports/${jobId}/images`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "No se pudieron subir las imágenes externas.";
    throw new Error(message);
  }
}

export async function fetchStagedImageCount(jobId: string): Promise<number> {
  const response = await fetch(
    `/api/admin/imports/${jobId}/images/review?page=1&pageSize=1`,
  );

  if (!response.ok) {
    return 0;
  }

  const payload = (await response.json()) as {
    pagination?: { total?: number };
  };

  return payload.pagination?.total ?? 0;
}
