import { vi } from "vitest";
import { deleteFile, uploadFile, createSignedDownloadUrl } from "@/server/storage";

export function setupStorageMocks(): void {
  vi.mocked(uploadFile).mockResolvedValue({
    path: "catalogs/test/cover-uuid.jpg",
    bucket: "product-images",
    sizeBytes: 1024,
    contentType: "image/jpeg",
  });
  vi.mocked(deleteFile).mockResolvedValue(undefined);
  vi.mocked(createSignedDownloadUrl).mockResolvedValue({
    signedUrl: "https://example.com/signed-url",
    bucket: "product-images",
    path: "catalogs/test/cover.jpg",
    expiresInSeconds: 3600,
  });
}
