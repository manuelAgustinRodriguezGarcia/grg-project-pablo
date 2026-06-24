import { getFileExtension } from "@/server/storage/sanitize-filename";

export function buildProductImageStoragePaths(
  folderId: string,
  productId: string,
  imageId: string,
  originalFilename: string,
): { storagePath: string; thumbnailPath: string } {
  const ext = getFileExtension(originalFilename) || ".jpg";
  return {
    storagePath: `folders/${folderId}/products/${productId}/${imageId}-original${ext}`,
    thumbnailPath: `folders/${folderId}/products/${productId}/${imageId}-thumb.webp`,
  };
}

export function buildColumnHelpImageStoragePaths(
  folderId: string,
  columnId: string,
  imageId: string,
  originalFilename: string,
): { storagePath: string; thumbnailPath: string } {
  const ext = getFileExtension(originalFilename) || ".jpg";
  return {
    storagePath: `${folderId}/${columnId}/${imageId}${ext}`,
    thumbnailPath: `${folderId}/${columnId}/${imageId}-thumb.webp`,
  };
}

export function buildImportExternalImagePath(
  jobId: string,
  uniqueId: string,
  originalFilename: string,
): string {
  const safeId = uniqueId.replace(/[^\w-]/g, "");
  return `imports/${jobId}/external/${safeId}-${originalFilename.replace(/[/\\]/g, "_")}`;
}
