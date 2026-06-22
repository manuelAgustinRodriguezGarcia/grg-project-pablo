import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportError } from "@/server/services/import.errors";

vi.mock("@/server/auth", () => ({
  requireRole: vi.fn(async () => ({
    profile: { id: "admin-1", role: "ADMIN", email: "admin@test.com", name: "Admin" },
  })),
}));

vi.mock("@/server/storage", () => ({
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  buildStoragePath: vi.fn(() => "imports/test.xlsx"),
}));

vi.mock("@/server/repositories/uploaded-file.repository", () => ({
  uploadedFileRepository: {
    create: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock("@/server/repositories/import-job.repository", () => ({
  importJobRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdWithRelations: vi.fn(),
    update: vi.fn(),
    replaceSheets: vi.fn(),
    deletePreview: vi.fn(),
    upsertPreview: vi.fn(),
  },
}));

vi.mock("@/server/repositories/folder.repository", () => ({
  folderRepository: {
    findById: vi.fn(),
    findByIdWithProductCount: vi.fn(),
  },
}));

vi.mock("@/server/repositories/catalog.repository", () => ({
  catalogRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/server/repositories/column.repository", () => ({
  columnRepository: {
    findByFolderIdOrdered: vi.fn(),
    createMany: vi.fn(),
  },
}));

vi.mock("@/server/repositories/product.repository", () => ({
  productRepository: {
    countByFolder: vi.fn(),
    findPrimaryCodesByFolder: vi.fn(),
    createMany: vi.fn(),
    deleteByFolder: vi.fn(),
  },
}));

vi.mock("@/server/database/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: () => Promise<void>) => callback()),
  },
}));

vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperationSafe: vi.fn(),
  },
}));

import { catalogImportService } from "@/server/services/catalog-import.service";
import { importJobRepository } from "@/server/repositories/import-job.repository";
import { folderRepository } from "@/server/repositories/folder.repository";

describe("CatalogImportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza apply sin confirmación en combinar", async () => {
    vi.mocked(importJobRepository.findByIdWithRelations).mockResolvedValue({
      id: "job-1",
      status: "READY_TO_APPLY",
      folderId: "folder-1",
      catalogId: "cat-1",
      targetSheetName: "Rodamientos",
      uploadedFile: {
        id: "file-1",
        originalName: "test.xlsx",
        storagePath: "imports/test.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: 100,
      },
      catalog: { id: "cat-1", name: "Rulemanes" },
      folder: { id: "folder-1", name: "Rodamientos", catalogId: "cat-1" },
      sheets: [],
      preview: {
        id: "preview-1",
        importJobId: "job-1",
        recognizedProducts: [],
        matchedProducts: [],
        errors: [],
        warnings: [],
        summary: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      uploadedFileId: "file-1",
      actionType: null,
      config: null,
      resultados: null,
      progress: null,
      errorMessage: null,
      startedAt: new Date(),
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    vi.mocked(folderRepository.findByIdWithProductCount).mockResolvedValue({
      id: "folder-1",
      catalogId: "cat-1",
      name: "Rodamientos",
      productCount: 5,
    } as never);

    await expect(
      catalogImportService.apply("job-1", {
        actionType: "COMBINAR_LISTA",
        confirmed: false,
      }),
    ).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    } satisfies Partial<ImportError>);
  });
});
