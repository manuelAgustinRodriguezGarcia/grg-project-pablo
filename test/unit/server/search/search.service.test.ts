import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProductSearchWhere } from "@/server/search/search.service";
import { createColumnFixture } from "../../../helpers/fixtures/column.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/server/repositories/product.repository", () => ({
  productRepository: {
    findPaginated: vi.fn(),
  },
}));

vi.mock("@/server/repositories/catalog.repository", () => ({
  catalogRepository: {
    findById: vi.fn(),
    findActiveOrdered: vi.fn(),
  },
}));

vi.mock("@/server/repositories/folder.repository", () => ({
  folderRepository: {
    findByCatalogIdOrdered: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("@/server/repositories/column.repository", () => ({
  columnRepository: {
    findByFolderIdOrdered: vi.fn(),
    findByGlobalFieldKey: vi.fn(),
  },
}));

vi.mock("@/server/services/product-image.service", () => ({
  productImageService: {
    resolvePrimaryImagesForProducts: vi.fn().mockResolvedValue(new Map()),
  },
}));

import { requireAuth } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { columnRepository } from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { productRepository } from "@/server/repositories/product.repository";
import { searchService } from "@/server/search/search.service";
import { createCatalogFixture } from "../../../helpers/fixtures/catalog.fixture";
import { createFolderFixture } from "../../../helpers/fixtures/folder.fixture";

describe("buildProductSearchWhere", () => {
  const searchableKeys = ["marca"];

  it("incluye coincidencia por código normalizado y equivalencias", () => {
    const where = buildProductSearchWhere("1-A", searchableKeys);
    expect(where).toHaveProperty("OR");

    const conditions = (where as { OR: unknown[] }).OR;
    expect(conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ normalizedCode: "1A" }),
        expect.objectContaining({
          equivalentCodes: expect.objectContaining({
            some: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({ normalizedCode: "1A" }),
              ]),
            }),
          }),
        }),
      ]),
    );
  });

  it("normaliza 0193-SILVA para búsqueda por equivalencia", () => {
    const where = buildProductSearchWhere("0193-SILVA", searchableKeys);
    const conditions = (where as { OR: unknown[] }).OR;
    expect(conditions).toEqual(
      expect.arrayContaining([expect.objectContaining({ normalizedCode: "0193SILVA" })]),
    );
  });
});

describe("searchService.searchInCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      profile: { id: "user-1", role: "ADMIN", email: "admin@test.com" },
      session: {} as never,
    });
  });

  it("devuelve productos que coinciden por equivalencia 2902", async () => {
    const catalog = createCatalogFixture();
    const folder = createFolderFixture({ catalogId: catalog.id });

    vi.mocked(catalogRepository.findById).mockResolvedValue(catalog);
    vi.mocked(folderRepository.findByCatalogIdOrdered).mockResolvedValue([
      { ...folder, productCount: 1 },
    ]);
    vi.mocked(columnRepository.findByFolderIdOrdered).mockResolvedValue([
      createColumnFixture({
        internalKey: "equivalencias",
        isEquivalence: true,
        isSearchable: true,
      }),
    ]);

    vi.mocked(productRepository.findPaginated).mockResolvedValue({
      items: [
        {
          id: "prod-1",
          folderId: folder.id,
          primaryCode: "MAIN",
          normalizedCode: "MAIN",
          description: "Disco",
          dynamicData: { equivalencias: "2902=1408" },
          originalText: null,
          indexedText: "MAIN 2902 1408",
          createdAt: new Date("2026-06-24T00:00:00.000Z"),
          updatedAt: new Date("2026-06-24T00:00:00.000Z"),
          equivalentCodes: [
            {
              id: "eq-1",
              productId: "prod-1",
              originalCode: "2902",
              normalizedCode: "2902",
              sourceColumnKey: "equivalencias",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          folder: {
            ...folder,
            catalog,
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    const result = await searchService.searchInCatalog({
      catalogId: catalog.id,
      query: "2902",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.matchType).toBe("equivalence");
    expect(result.items[0]?.matchValue).toBe("2902");
    expect(result.items[0]?.folder.name).toBe(folder.name);
  });
});
