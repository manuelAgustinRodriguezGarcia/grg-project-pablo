import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForbiddenError } from "@/server/auth/errors";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { folderService } from "@/server/services/folder.service";
import {
  adminUserFixture,
  mockRequireRole,
  mockRequireRoleForbidden,
} from "../../../helpers/mocks/auth";
import { createCatalogFixture, CATALOG_ID } from "../../../helpers/fixtures/catalog.fixture";
import {
  createFolderWithProductCountFixture,
  FOLDER_ID,
} from "../../../helpers/fixtures/folder.fixture";
import {
  mockFolderExists,
  setupFolderRepositoryMocks,
} from "../../../helpers/mocks/folder.repository";
import { setupCatalogRepositoryMocks } from "../../../helpers/mocks/catalog.repository";

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
vi.mock("@/server/repositories/folder.repository", () => ({
  folderRepository: {
    findByCatalogIdOrdered: vi.fn(),
    findById: vi.fn(),
    findByIdWithProductCount: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    clearProducts: vi.fn(),
    reorder: vi.fn(),
    getNextOrder: vi.fn(),
    findManyByIds: vi.fn(),
    countByCatalogAndName: vi.fn(),
    countByCatalogId: vi.fn(),
    isUniqueConstraintError: vi.fn(),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperation: vi.fn(),
    logOperationSafe: vi.fn(),
  },
}));

describe("FolderService", () => {
  const folderFixture = createFolderWithProductCountFixture();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    setupCatalogRepositoryMocks();
    setupFolderRepositoryMocks();
    vi.mocked(catalogRepository.findById).mockResolvedValue(createCatalogFixture());
    mockFolderExists();
  });

  describe("createFolder", () => {
    it("crea una carpeta y registra auditoría", async () => {
      const result = await folderService.createFolder({
        catalogId: CATALOG_ID,
        name: "  Rodamientos  ",
        description: "Descripción",
      });

      expect(result.name).toBe("Rodamientos");
      expect(result.productCount).toBe(0);
      expect(folderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          catalogId: CATALOG_ID,
          name: "Rodamientos",
          description: "Descripción",
        }),
      );
      expect(auditService.logOperationSafe).toHaveBeenCalledWith({
        userId: adminUserFixture.id,
        action: AUDIT_ACTIONS.FOLDER_CREATED,
        entityType: AUDIT_ENTITY_TYPES.FOLDER,
        entityId: expect.any(String),
      });
    });

    it("rechaza nombre vacío", async () => {
      await expect(
        folderService.createFolder({ catalogId: CATALOG_ID, name: "   " }),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("rechaza usuarios sin rol ADMIN", async () => {
      mockRequireRoleForbidden();

      await expect(
        folderService.createFolder({ catalogId: CATALOG_ID, name: "Rodamientos" }),
      ).rejects.toBeInstanceOf(AuthForbiddenError);
    });

    it("rechaza nombre duplicado", async () => {
      vi.mocked(folderRepository.countByCatalogAndName).mockResolvedValue(1);

      await expect(
        folderService.createFolder({ catalogId: CATALOG_ID, name: "Rodamientos" }),
      ).rejects.toMatchObject({ code: "FOLDER_DUPLICATE_NAME" });
    });
  });

  describe("createFolderFromSheet", () => {
    it("delega la creación usando el nombre de la hoja", async () => {
      const result = await folderService.createFolderFromSheet({
        catalogId: CATALOG_ID,
        sheetName: "  Hoja Excel  ",
      });

      expect(result.name).toBe("Hoja Excel");
      expect(folderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Hoja Excel" }),
      );
    });
  });

  describe("updateFolder", () => {
    it("retorna la carpeta existente si no hay cambios", async () => {
      const result = await folderService.updateFolder({ id: FOLDER_ID });

      expect(result).toEqual(folderFixture);
      expect(folderRepository.update).not.toHaveBeenCalled();
    });

    it("lanza error si la carpeta no existe", async () => {
      vi.mocked(folderRepository.findByIdWithProductCount).mockResolvedValue(null);

      await expect(
        folderService.updateFolder({ id: FOLDER_ID, name: "Nuevo" }),
      ).rejects.toMatchObject({ code: "FOLDER_NOT_FOUND" });
    });
  });

  describe("reorderFolders", () => {
    it("rechaza carpetas de otro catálogo", async () => {
      vi.mocked(folderRepository.findManyByIds).mockResolvedValue([
        {
          ...folderFixture,
          catalogId: "clh3pb1a3000099999999999ab",
        },
      ]);

      await expect(
        folderService.reorderFolders({
          catalogId: CATALOG_ID,
          items: [{ id: FOLDER_ID, order: 1 }],
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  describe("setFolderVisibility", () => {
    it("no actualiza si la visibilidad ya coincide", async () => {
      const result = await folderService.setFolderVisibility(FOLDER_ID, true);

      expect(result).toEqual(folderFixture);
      expect(folderRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteFolder", () => {
    it("elimina la carpeta con auditoría", async () => {
      await folderService.deleteFolder(FOLDER_ID);

      expect(folderRepository.delete).toHaveBeenCalledWith(FOLDER_ID);
      expect(auditService.logOperationSafe).toHaveBeenCalledWith({
        userId: adminUserFixture.id,
        action: AUDIT_ACTIONS.FOLDER_DELETED,
        entityType: AUDIT_ENTITY_TYPES.FOLDER,
        entityId: FOLDER_ID,
      });
    });
  });

  describe("clearFolder", () => {
    it("vacía productos y registra auditoría", async () => {
      vi.mocked(folderRepository.clearProducts).mockResolvedValue(5);

      const result = await folderService.clearFolder(FOLDER_ID);

      expect(result).toEqual({ deletedProductCount: 5 });
      expect(auditService.logOperationSafe).toHaveBeenCalledWith({
        userId: adminUserFixture.id,
        action: AUDIT_ACTIONS.FOLDER_CLEARED,
        entityType: AUDIT_ENTITY_TYPES.FOLDER,
        entityId: FOLDER_ID,
      });
    });
  });

  describe("setFolderSearchConfig", () => {
    it("persiste la configuración de búsqueda", async () => {
      const config = { columnInternalKeys: ["codigo", "descripcion"] };

      const result = await folderService.setFolderSearchConfig(FOLDER_ID, config);

      expect(folderRepository.update).toHaveBeenCalledWith(FOLDER_ID, {
        searchConfig: config,
      });
      expect(result.searchConfig).toEqual(config);
    });

    it("rechaza claves duplicadas", async () => {
      await expect(
        folderService.setFolderSearchConfig(FOLDER_ID, {
          columnInternalKeys: ["codigo", "codigo"],
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  describe("listFolders", () => {
    it("rechaza catálogo inexistente", async () => {
      vi.mocked(catalogRepository.findById).mockResolvedValue(null);

      await expect(folderService.listFolders(CATALOG_ID)).rejects.toMatchObject({
        code: "CATALOG_NOT_FOUND",
      });
    });
  });
});
