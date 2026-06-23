import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { columnRepository } from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { productRepository } from "@/server/repositories/product.repository";
import { productService } from "@/server/services/product.service";
import {
  adminUserFixture,
  consultaUserFixture,
  mockRequireAuth,
} from "../../../helpers/mocks/auth";
import { createCatalogFixture } from "../../../helpers/fixtures/catalog.fixture";
import {
  createFolderFixture,
  FOLDER_ID,
} from "../../../helpers/fixtures/folder.fixture";
import { createColumnFixture } from "../../../helpers/fixtures/column.fixture";
import { createProductFixture } from "../../../helpers/fixtures/product.fixture";
import {
  mockProductsPaginated,
  setupProductRepositoryMocks,
} from "../../../helpers/mocks/product.repository";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/server/repositories/catalog.repository", () => ({
  catalogRepository: {
    findById: vi.fn(),
  },
}));
vi.mock("@/server/repositories/folder.repository", () => ({
  folderRepository: {
    findById: vi.fn(),
  },
}));
vi.mock("@/server/repositories/column.repository", () => ({
  columnRepository: {
    findByFolderIdOrdered: vi.fn(),
  },
}));
vi.mock("@/server/repositories/product.repository", () => ({
  productRepository: {
    findByFolderPaginated: vi.fn(),
    findById: vi.fn(),
    countByFolder: vi.fn(),
  },
}));
vi.mock("@/server/services/product-image.service", () => ({
  productImageService: {
    resolvePrimaryImagesForProducts: vi.fn(async () => new Map()),
  },
}));

describe("ProductService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth(adminUserFixture);
    setupProductRepositoryMocks();
    vi.mocked(folderRepository.findById).mockResolvedValue(createFolderFixture());
    vi.mocked(catalogRepository.findById).mockResolvedValue(createCatalogFixture());
    vi.mocked(columnRepository.findByFolderIdOrdered).mockResolvedValue([
      createColumnFixture({ internalKey: "marca", visibleToNormalUser: true }),
      createColumnFixture({
        id: "hidden-column",
        internalKey: "nota_interna",
        visibleToNormalUser: false,
      }),
    ]);
    mockProductsPaginated();
  });

  it("devuelve productos paginados con columnas configuradas", async () => {
    const result = await productService.listProductsByFolder({
      folderId: FOLDER_ID,
      page: 1,
      pageSize: 50,
    });

    expect(result.folder.id).toBe(FOLDER_ID);
    expect(result.columns).toHaveLength(2);
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
});
