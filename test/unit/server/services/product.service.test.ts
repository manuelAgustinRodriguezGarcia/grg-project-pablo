import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { columnRepository } from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { productRepository } from "@/server/repositories/product.repository";
import { productService } from "@/server/services/product.service";
import { equivalenceService } from "@/server/services/equivalence.service";
import {
  adminUserFixture,
  consultaUserFixture,
  mockRequireAuth,
  mockRequireRole,
} from "../../../helpers/mocks/auth";
import { createCatalogFixture } from "../../../helpers/fixtures/catalog.fixture";
import {
  createFolderFixture,
  FOLDER_ID,
} from "../../../helpers/fixtures/folder.fixture";
import { createColumnFixture } from "../../../helpers/fixtures/column.fixture";
import {
  createProductFixture,
  PRODUCT_ID,
} from "../../../helpers/fixtures/product.fixture";
import {
  mockProductsPaginated,
  setupProductRepositoryMocks,
} from "../../../helpers/mocks/product.repository";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/server/repositories/catalog.repository", () => ({
  catalogRepository: { findById: vi.fn() },
}));
vi.mock("@/server/repositories/folder.repository", () => ({
  folderRepository: { findById: vi.fn() },
}));
vi.mock("@/server/repositories/column.repository", () => ({
  columnRepository: { findByFolderIdOrdered: vi.fn() },
}));
vi.mock("@/server/repositories/product.repository", () => ({
  productRepository: {
    findByFolderPaginated: vi.fn(),
    findById: vi.fn(),
    countByFolder: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByFolderId: vi.fn(),
  },
}));
vi.mock("@/server/repositories/product-image.repository", () => ({
  productImageRepository: {
    findByProduct: vi.fn(async () => []),
  },
}));
vi.mock("@/server/services/product-image.service", () => ({
  productImageService: {
    resolvePrimaryImagesForProducts: vi.fn(async () => new Map()),
    duplicateImagesForProduct: vi.fn(async () => undefined),
  },
}));
vi.mock("@/server/services/equivalence.service", () => ({
  equivalenceService: {
    listByProduct: vi.fn(async () => []),
    syncFromProduct: vi.fn(async () => []),
    copyToProduct: vi.fn(async () => 0),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: { logOperationSafe: vi.fn() },
}));
vi.mock("@/server/storage", () => ({
  deleteFile: vi.fn(),
}));

describe("ProductService", () => {
  const columns = [
    createColumnFixture({
      internalKey: "codigo",
      displayName: "Código",
      isPrimaryCode: true,
      isRequired: true,
    }),
    createColumnFixture({
      id: "desc-col",
      internalKey: "descripcion",
      displayName: "Descripción",
      isDescription: true,
      isSearchable: true,
    }),
    createColumnFixture({
      id: "hidden-column",
      internalKey: "nota_interna",
      displayName: "Nota interna",
      visibleToNormalUser: false,
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth(adminUserFixture);
    mockRequireRole(adminUserFixture);
    setupProductRepositoryMocks();
    vi.mocked(folderRepository.findById).mockResolvedValue(createFolderFixture());
    vi.mocked(catalogRepository.findById).mockResolvedValue(createCatalogFixture());
    vi.mocked(columnRepository.findByFolderIdOrdered).mockResolvedValue(columns);
    mockProductsPaginated();
  });

  it("devuelve productos paginados con columnas configuradas", async () => {
    const result = await productService.listProductsByFolder({
      folderId: FOLDER_ID,
      page: 1,
      pageSize: 50,
    });

    expect(result.folder.id).toBe(FOLDER_ID);
    expect(result.columns).toHaveLength(3);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.primaryImage).toBeNull();
    expect(result.pagination.total).toBe(1);
  });

  it("CONSULTA no recibe columnas ocultas ni claves ocultas en dynamicData", async () => {
    mockRequireAuth(consultaUserFixture);
    vi.mocked(columnRepository.findByFolderIdOrdered).mockResolvedValue([
      createColumnFixture({ internalKey: "marca", visibleToNormalUser: true }),
    ]);
    vi.mocked(productRepository.findByFolderPaginated).mockResolvedValue({
      items: [createProductFixture()],
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    const result = await productService.listProductsByFolder({ folderId: FOLDER_ID });

    expect(result.columns).toHaveLength(1);
    expect(result.products[0]?.dynamicData).toEqual({ marca: "SKF" });
    expect(columnRepository.findByFolderIdOrdered).toHaveBeenCalledWith(
      FOLDER_ID,
      { visibleToNormalUser: true },
    );
  });

  it("CONSULTA no accede a carpeta oculta", async () => {
    mockRequireAuth(consultaUserFixture);
    vi.mocked(folderRepository.findById).mockResolvedValue(
      createFolderFixture({ visibleToNormalUser: false }),
    );

    await expect(
      productService.listProductsByFolder({ folderId: FOLDER_ID }),
    ).rejects.toMatchObject({ code: "FOLDER_NOT_FOUND" });
  });

  it("crea un producto y sincroniza equivalencias", async () => {
    const created = createProductFixture({ id: "new-product" });
    vi.mocked(productRepository.create).mockResolvedValue(created);
    vi.mocked(productRepository.findById).mockResolvedValue(created);

    const result = await productService.createProduct({
      folderId: FOLDER_ID,
      values: {
        codigo: "6205",
        descripcion: "Ruleman",
      },
    });

    expect(productRepository.create).toHaveBeenCalled();
    expect(equivalenceService.syncFromProduct).toHaveBeenCalledWith(
      created.id,
      columns,
      expect.any(Object),
    );
    expect(result.id).toBe(created.id);
  });

  it("actualiza un producto existente", async () => {
    const existing = createProductFixture();
    vi.mocked(productRepository.findById).mockResolvedValue(existing);
    vi.mocked(productRepository.update).mockResolvedValue({
      ...existing,
      description: "Actualizado",
    });

    const result = await productService.updateProduct({
      productId: PRODUCT_ID,
      values: { descripcion: "Actualizado" },
    });

    expect(productRepository.update).toHaveBeenCalled();
    expect(result.id).toBe(PRODUCT_ID);
  });

  it("elimina un producto", async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(createProductFixture());

    await productService.deleteProduct(PRODUCT_ID);

    expect(productRepository.delete).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it("duplica un producto", async () => {
    const source = createProductFixture();
    const duplicate = createProductFixture({ id: "dup-product", primaryCode: "6205 (copia)" });
    vi.mocked(productRepository.findById)
      .mockResolvedValueOnce(source)
      .mockResolvedValue(duplicate);
    vi.mocked(productRepository.create).mockResolvedValue(duplicate);

    const result = await productService.duplicateProduct(PRODUCT_ID);

    expect(productRepository.create).toHaveBeenCalled();
    expect(equivalenceService.copyToProduct).toHaveBeenCalledWith(
      PRODUCT_ID,
      duplicate.id,
    );
    expect(result.id).toBe(duplicate.id);
  });
});
