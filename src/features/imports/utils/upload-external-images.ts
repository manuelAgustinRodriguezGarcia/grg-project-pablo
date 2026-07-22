import {
  hasExternalImages,
  type ExternalImageSelection,
} from "./external-images";
import { uploadExternalImagesToJobDirect } from "./direct-import-upload";

/** @deprecated Prefer uploadExternalImagesToJobDirect — kept as alias for callers. */
export async function uploadExternalImagesToJob(
  jobId: string,
  selection: ExternalImageSelection,
): Promise<void> {
  await uploadExternalImagesToJobDirect(jobId, selection);
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

// Re-export for type-only consumers that imported hasExternalImages from here historically.
export type { ExternalImageSelection };
export { hasExternalImages };
