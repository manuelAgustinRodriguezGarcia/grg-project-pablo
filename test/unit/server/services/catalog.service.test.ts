import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForbiddenError } from "@/server/auth/errors";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { deleteFile, uploadFile } from "@/server/storage";
import { StorageError } from "@/server/storage/errors";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { CatalogError } from "@/server/services/catalog.errors";
import { catalogService } from "@/server/services/catalog.service";
import { requireRole } from "@/server/auth";
import {
  adminUserFixture,
  mockRequireRole,
  mockRequireRoleForbidden,
} from "../../../helpers/mocks/auth";
import { setupCatalogRepositoryMocks } from "../../../helpers/mocks/catalog.repository";
import {
  CATALOG_ID,
  createCatalogWithFolderCountFixture,
} from "../../../helpers/fixtures/catalog.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/server/repositories/catalog.repository", () => ({
  catalogRepository: {
    findActiveOrdered: vi.fn(),
    findAllOrdered: vi.fn(),
    findAllOrderedWithFolderCount: vi.fn(),
    findById: vi.fn(),
    findByIdWithFolderCount: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    clearProducts: vi.fn(),
    reorder: vi.fn(),
    getNextOrder: vi.fn(),
    countFolders: vi.fn(),
    findManyByIds: vi.fn(),
    countProducts: vi.fn(),
  },
}));
vi.mock("@/server/storage", () => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperation: vi.fn(),
    logOperationSafe: vi.fn(),
  },
}));

describe("CatalogService", () => {
  const catalogFixture = createCatalogWithFolderCountFixture();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    setupCatalogRepositoryMocks();
    vi.mocked(catalogRepository.findByIdWithFolderCount).mockResolvedValue(
      catalogFixture,
    );
  });

  describe("createCatalog", () => {
    it("crea un catálogo y registra auditoría", async () => {
      const result = await catalogService.createCatalog({
        name: "  Rulemanes  ",
        description: "Descripción",
      });

      expect(result.name).toBe("Rulemanes");
      expect(result.folderCount).toBe(0);
      expect(catalogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Rulemanes",
          description: "Descripción",
        }),
      );
      expect(auditService.logOperationSafe).toHaveBeenCalledWith({
        userId: adminUserFixture.id,
        action: AUDIT_ACTIONS.CATALOG_CREATED,
        entityType: AUDIT_ENTITY_TYPES.CATALOG,
        entityId: expect.any(String),
      });
    });

    it("rechaza nombre vacío", async () => {
      await expect(
        catalogService.createCatalog({ name: "   " }),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("rechaza usuarios sin rol ADMIN", async () => {
      mockRequireRoleForbidden();

      await expect(
        catalogService.createCatalog({ name: "Rulemanes" }),
      ).rejects.toBeInstanceOf(AuthForbiddenError);
    });
  });

  describe("updateCatalog", () => {
    it("retorna el catálogo existente si no hay cambios", async () => {
      const result = await catalogService.updateCatalog({ id: CATALOG_ID });

      expect(result).toEqual(catalogFixture);
      expect(catalogRepository.update).not.toHaveBeenCalled();
    });

    it("lanza error si el catálogo no existe", async () => {
      vi.mocked(catalogRepository.findByIdWithFolderCount).mockResolvedValue(null);

      await expect(
        catalogService.updateCatalog({ id: CATALOG_ID, name: "Nuevo" }),
      ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });
    });
  });

  describe("reorderCatalogs", () => {
    it("rechaza listas vacías", async () => {
      await expect(
        catalogService.reorderCatalogs({ items: [] }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("rechaza ids inexistentes", async () => {
      vi.mocked(catalogRepository.findManyByIds).mockResolvedValue([]);

      await expect(
        catalogService.reorderCatalogs({
          items: [{ id: CATALOG_ID, order: 1 }],
        }),
      ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });
    });
  });

  describe("setCatalogVisibility", () => {
    it("no actualiza si la visibilidad ya coincide", async () => {
      const result = await catalogService.setCatalogVisibility(CATALOG_ID, true);

      expect(result).toEqual(catalogFixture);
      expect(catalogRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteCatalog", () => {
    it("elimina portada y catálogo con auditoría", async () => {
      vi.mocked(catalogRepository.findByIdWithFolderCount).mockResolvedValue(
        createCatalogWithFolderCountFixture({
          coverImagePath: "catalogs/cover.jpg",
        }),
      );

      await catalogService.deleteCatalog(CATALOG_ID);

      expect(deleteFile).toHaveBeenCalled();
      expect(catalogRepository.delete).toHaveBeenCalledWith(CATALOG_ID);
      expect(auditService.logOperationSafe).toHaveBeenCalledWith({
        userId: adminUserFixture.id,
        action: AUDIT_ACTIONS.CATALOG_DELETED,
        entityType: AUDIT_ENTITY_TYPES.CATALOG,
        entityId: CATALOG_ID,
      });
    });
  });

  describe("clearCatalog", () => {
    it("vacia productos y registra auditoría", async () => {
      vi.mocked(catalogRepository.clearProducts).mockResolvedValue(5);

      const result = await catalogService.clearCatalog(CATALOG_ID);

      expect(result).toEqual({ deletedProductCount: 5 });
      expect(auditService.logOperationSafe).toHaveBeenCalledWith({
        userId: adminUserFixture.id,
        action: AUDIT_ACTIONS.CATALOG_CLEARED,
        entityType: AUDIT_ENTITY_TYPES.CATALOG,
        entityId: CATALOG_ID,
      });
    });
  });

  describe("setCoverImage", () => {
    it("mapea StorageError a CatalogError", async () => {
      vi.mocked(uploadFile).mockRejectedValue(
        new StorageError("Tipo MIME no permitido"),
      );

      await expect(
        catalogService.setCoverImage({
          catalogId: CATALOG_ID,
          body: Buffer.from("data"),
          contentType: "image/jpeg",
          originalFilename: "cover.jpg",
        }),
      ).rejects.toBeInstanceOf(CatalogError);
    });
  });

  describe("removeCoverImage", () => {
    it("no hace nada si no hay portada", async () => {
      const result = await catalogService.removeCoverImage(CATALOG_ID);

      expect(result).toEqual(catalogFixture);
      expect(deleteFile).not.toHaveBeenCalled();
    });
  });
});
