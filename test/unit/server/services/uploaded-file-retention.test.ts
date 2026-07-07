import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/repositories/import-job.repository", () => ({
  importJobRepository: {},
}));

vi.mock("@/server/repositories/uploaded-file.repository", () => ({
  uploadedFileRepository: {},
}));

vi.mock("@/server/storage", () => ({
  deleteFile: vi.fn(),
}));

import {
  hasRetainedImport,
  isRetainedImportJob,
} from "@/server/services/uploaded-file-retention";

describe("uploaded-file-retention", () => {
  it("retiene jobs publicados con destino de catálogo", () => {
    expect(
      isRetainedImportJob({
        status: "PUBLISHED",
        catalogId: "cat-1",
        folderId: "folder-1",
        priceListId: null,
      }),
    ).toBe(true);
  });

  it("retiene jobs en revisión de imágenes", () => {
    expect(
      isRetainedImportJob({
        status: "PENDING_REVIEW",
        catalogId: "cat-1",
        folderId: "folder-1",
        priceListId: null,
      }),
    ).toBe(true);
  });

  it("no retiene jobs cancelados aunque tengan destino", () => {
    expect(
      isRetainedImportJob({
        status: "CANCELLED",
        catalogId: "cat-1",
        folderId: "folder-1",
        priceListId: null,
      }),
    ).toBe(false);
  });

  it("no retiene jobs publicados sin destino válido", () => {
    expect(
      isRetainedImportJob({
        status: "PUBLISHED",
        catalogId: null,
        folderId: null,
        priceListId: null,
      }),
    ).toBe(false);
  });

  it("hasRetainedImport requiere al menos un job retenido", () => {
    expect(
      hasRetainedImport([
        {
          status: "STORED",
          catalogId: "cat-1",
          folderId: "folder-1",
          priceListId: null,
        },
        {
          status: "PUBLISHED",
          catalogId: "cat-1",
          folderId: "folder-1",
          priceListId: null,
        },
      ]),
    ).toBe(true);

    expect(
      hasRetainedImport([
        {
          status: "FAILED",
          catalogId: "cat-1",
          folderId: "folder-1",
          priceListId: null,
        },
      ]),
    ).toBe(false);
  });
});
