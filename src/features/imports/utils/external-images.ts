export const EXTERNAL_IMAGE_MAX_BYTES = 50 * 1024 * 1024;

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export type ExternalImageSelection = {
  zipFile: File | null;
  imageFiles: File[];
};

export type StagedExternalImageSource = {
  name: string;
  sizeBytes: number;
  kind: "zip" | "image";
};

export type StagedExternalImagesSummary = {
  sources: StagedExternalImageSource[];
  imageCount: number;
};

export function snapshotExternalImageSources(
  selection: ExternalImageSelection,
): StagedExternalImageSource[] {
  const sources: StagedExternalImageSource[] = [];

  if (selection.zipFile) {
    sources.push({
      name: selection.zipFile.name,
      sizeBytes: selection.zipFile.size,
      kind: "zip",
    });
  }

  for (const image of selection.imageFiles) {
    sources.push({
      name: image.name,
      sizeBytes: image.size,
      kind: "image",
    });
  }

  return sources;
}

export function hasStagedExternalImagesSummary(
  summary: StagedExternalImagesSummary | null | undefined,
): summary is StagedExternalImagesSummary {
  if (!summary) {
    return false;
  }

  return summary.sources.length > 0 || summary.imageCount > 0;
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function formatExternalFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function validateExternalImageFile(file: File): string | null {
  const extension = getExtension(file.name);
  const isZip = extension === ".zip";
  const isImage = IMAGE_EXTENSIONS.includes(extension);

  if (!isZip && !isImage) {
    return `Formato no permitido: ${file.name}`;
  }

  if (file.size > EXTERNAL_IMAGE_MAX_BYTES) {
    return `${file.name} supera el tamaño máximo permitido (50 MB).`;
  }

  return null;
}

export function appendExternalImagesToFormData(
  formData: FormData,
  selection: ExternalImageSelection,
): void {
  if (selection.zipFile) {
    formData.append("imagesZip", selection.zipFile);
  }

  for (const image of selection.imageFiles) {
    formData.append("images", image);
  }
}

export function hasExternalImages(selection: ExternalImageSelection): boolean {
  return Boolean(selection.zipFile) || selection.imageFiles.length > 0;
}

export function countExternalImages(selection: ExternalImageSelection): number {
  return (selection.zipFile ? 1 : 0) + selection.imageFiles.length;
}
