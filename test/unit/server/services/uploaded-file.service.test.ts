import { beforeEach, describe, expect, it, vi } from "vitest";
import { UploadedFileError } from "@/server/services/uploaded-file.errors";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(async () => ({
    profile: { id: "admin-1", role: "ADMIN", email: "admin@test.com", name: "Admin" },
  })),
  requireRole: vi.fn(async () => ({
    profile: { id: "admin-1", role: "ADMIN", email: "admin@test.com", name: "Admin" },
  })),
  requireAdmin: vi.fn(async () => ({
    profile: { id: "admin-1", role: "ADMIN", email: "admin@test.com", name: "Admin" },
  })),
  requireEditor: vi.fn(async () => ({
    profile: { id: "admin-1", role: "ADMIN", email: "admin@test.com", name: "Admin" },
  })),
}));

vi.mock("@/server/repositories/uploaded-file.repository", () => ({
  uploadedFileRepository: {
    findManyPaginated: vi.fn(),
    findById: vi.fn(),
    findByIdWithHistory: vi.fn(),
    deleteById: vi.fn(),
  },
}));

vi.mock("@/server/repositories/import-job.repository", () => ({
  importJobRepository: {
    findActiveByUploadedFileId: vi.fn(),
    cancelAllActiveByUploadedFileId: vi.fn(),
    hasPublishedOrPendingReviewJob: vi.fn(),
  },
}));

vi.mock("@/server/services/catalog-import.service", () => ({
  catalogImportService: {
    createJobFromUploadedFile: vi.fn(),
  },
}));

vi.mock("@/server/storage", () => ({
  createSignedDownloadUrl: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperationSafe: vi.fn(),
  },
}));

import { uploadedFileService } from "@/server/services/uploaded-file.service";
import { uploadedFileRepository } from "@/server/repositories/uploaded-file.repository";
import { importJobRepository } from "@/server/repositories/import-job.repository";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { createSignedDownloadUrl, deleteFile } from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";

const baseFile = {
  id: "file-1",
  originalName: "Rulemanes.xlsx",
  storagePath: "imports/rulemanes.xlsx",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  sizeBytes: 1024,
  status: "PROCESSED" as const,
  uploadedById: "admin-1",
  createdAt: new Date("2026-06-22T12:00:00.000Z"),
  updatedAt: new Date("2026-06-22T12:00:00.000Z"),
  uploadedBy: { id: "admin-1", name: "Admin", email: "admin@test.com" },
  importJobs: [
    {
      id: "job-1",
      status: "PUBLISHED",
      destinationType: "CATALOG_FOLDER",
      actionType: "COMBINAR_LISTA",
      catalogId: "cat-1",
      folderId: "folder-1",
      priceListId: null,
      targetSheetName: "SKF",
      resultados: {
        sheetsDetected: 3,
        productsCreated: 120,
        productsSkipped: 5,
        errors: [],
      },
      errorMessage: null,
      finishedAt: new Date("2026-06-22T12:30:00.000Z"),
      createdAt: new Date("2026-06-22T12:10:00.000Z"),
      catalog: { id: "cat-1", name: "Rulemanes" },
      folder: { id: "folder-1", name: "SKF", catalogId: "cat-1" },
      priceList: null,
      sheets: [{ id: "sheet-1", sheetName: "SKF" }],
    },
  ],
};

describe("UploadedFileService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listFiles pagina y mapea latestJob", async () => {
    vi.mocked(uploadedFileRepository.findManyPaginated).mockResolvedValue({
      items: [baseFile],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const result = await uploadedFileService.listFiles({
      page: 1,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.originalName).toBe("Rulemanes.xlsx");
    expect(result.items[0]?.extension).toBe("xlsx");
    expect(result.items[0]?.latestJob?.productsCreated).toBe(120);
    expect(result.pagination.total).toBe(1);
  });

  it("getDownloadUrl genera URL firmada en excel-originals", async () => {
    vi.mocked(uploadedFileRepository.findByIdWithHistory).mockResolvedValue(baseFile);
    vi.mocked(createSignedDownloadUrl).mockResolvedValue({
      bucket: STORAGE_BUCKETS.EXCEL_ORIGINALS,
      path: baseFile.storagePath,
      signedUrl: "https://signed.example/file",
      expiresInSeconds: 3600,
    });

    const result = await uploadedFileService.getDownloadUrl("file-1");

    expect(createSignedDownloadUrl).toHaveBeenCalledWith(
      STORAGE_BUCKETS.EXCEL_ORIGINALS,
      baseFile.storagePath,
    );
    expect(result.url).toBe("https://signed.example/file");
    expect(result.originalName).toBe("Rulemanes.xlsx");
  });

  it("reprocess delega a createJobFromUploadedFile", async () => {
    vi.mocked(uploadedFileRepository.findByIdWithHistory).mockResolvedValue(baseFile);
    vi.mocked(importJobRepository.findActiveByUploadedFileId).mockResolvedValue(null);
    vi.mocked(catalogImportService.createJobFromUploadedFile).mockResolvedValue({
      jobId: "job-2",
      uploadedFileId: "file-1",
    });

    const result = await uploadedFileService.reprocess("file-1");

    expect(result).toEqual({ jobId: "job-2", uploadedFileId: "file-1" });
    expect(catalogImportService.createJobFromUploadedFile).toHaveBeenCalledWith("file-1");
  });

  it("deleteFile cancela importaciones activas antes de eliminar", async () => {
    vi.mocked(uploadedFileRepository.findByIdWithHistory).mockResolvedValue(baseFile);
    vi.mocked(importJobRepository.cancelAllActiveByUploadedFileId).mockResolvedValue(1);
    vi.mocked(importJobRepository.hasPublishedOrPendingReviewJob).mockResolvedValue(false);

    await uploadedFileService.deleteFile("file-1", { confirmed: false });

    expect(importJobRepository.cancelAllActiveByUploadedFileId).toHaveBeenCalledWith("file-1");
    expect(deleteFile).toHaveBeenCalled();
    expect(uploadedFileRepository.deleteById).toHaveBeenCalledWith("file-1");
  });

  it("deleteFile rechaza sin confirmación si hay job publicado", async () => {
    vi.mocked(uploadedFileRepository.findByIdWithHistory).mockResolvedValue(baseFile);
    vi.mocked(importJobRepository.cancelAllActiveByUploadedFileId).mockResolvedValue(0);
    vi.mocked(importJobRepository.hasPublishedOrPendingReviewJob).mockResolvedValue(true);

    await expect(
      uploadedFileService.deleteFile("file-1", { confirmed: false }),
    ).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    } satisfies Partial<UploadedFileError>);

    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("deleteFile elimina Storage y registro cuando es válido", async () => {
    vi.mocked(uploadedFileRepository.findByIdWithHistory).mockResolvedValue(baseFile);
    vi.mocked(importJobRepository.cancelAllActiveByUploadedFileId).mockResolvedValue(0);
    vi.mocked(importJobRepository.hasPublishedOrPendingReviewJob).mockResolvedValue(true);

    const result = await uploadedFileService.deleteFile("file-1", { confirmed: true });

    expect(deleteFile).toHaveBeenCalledWith(
      STORAGE_BUCKETS.EXCEL_ORIGINALS,
      baseFile.storagePath,
    );
    expect(uploadedFileRepository.deleteById).toHaveBeenCalledWith("file-1");
    expect(result.success).toBe(true);
  });
});
