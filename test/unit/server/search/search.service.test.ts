import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProductSearchWhere } from "@/server/search/search.service";
import { createColumnFixture } from "../../../helpers/fixtures/column.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/server/repositories/product.repository", () => ({
  productRepository: {
    findPaginated: vi.fn(),
    findSearchPaginated: vi.fn(),
  },
}));

vi.mock("@/server/repositories/catalog.repository", () => ({
  catalogRepository: {
    findById: vi.fn(),
    findActiveOrdered: vi.fn(),
    findMatching: vi.fn(),
  },
}));

vi.mock("@/server/repositories/folder.repository", () => ({
  folderRepository: {
    findByCatalogIdOrdered: vi.fn(),
    findIdsByCatalogId: vi.fn(),
    findAccessibleIds: vi.fn(),
    findMatching: vi.fn(),
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
  it("incluye coincidencia por código normalizado y equivalencias", () => {
    const where = buildProductSearchWhere("1-A");
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
    const where = buildProductSearchWhere("0193-SILVA");
    const conditions = (where as { OR: unknown[] }).OR;
    expect(conditions).toEqual(
      expect.arrayContaining([expect.objectContaining({ normalizedCode: "0193SILVA" })]),
    );
  });

  it("busca texto en indexedText y originalText sin depender de claves de columna", () => {
    const where = buildProductSearchWhere("bomba agua");
    const conditions = (where as { OR: unknown[] }).OR;

    expect(conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexedText: expect.objectContaining({ contains: "bomba agua" }),
        }),
        expect.objectContaining({
          originalText: expect.objectContaining({ contains: "bomba agua" }),
        }),
      ]),
    );
    expect(conditions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ dynamicData: expect.anything() })]),
    );
  });

  it("busca en texto para una palabra única sin separadores (p. ej. marca INDIEL)", () => {
    const where = buildProductSearchWhere("INDIEL");
    const conditions = (where as { OR: unknown[] }).OR;

    expect(conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexedText: expect.objectContaining({ contains: "INDIEL" }),
        }),
        expect.objectContaining({
          originalText: expect.objectContaining({ contains: "INDIEL" }),
        }),
      ]),
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

    vi.mocked(productRepository.findSearchPaginated).mockResolvedValue({
      items: [
        {
          id: "prod-1",
          folderId: folder.id,
          primaryCode: "MAIN",
          normalizedCode: "MAIN",
          description: "Disco",
          dynamicData: { equivalencias: "2902=1408" },
          indexedText: "MAIN 2902 1408",
          equivalentCodes: [
            {
              originalCode: "2902",
              normalizedCode: "2902",
            },
          ],
          folder: {
            id: folder.id,
            name: folder.name,
            catalog: {
              id: catalog.id,
              name: catalog.name,
            },
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

describe("searchService.searchGlobal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      profile: { id: "user-1", role: "ADMIN", email: "admin@test.com" },
      session: {} as never,
    });
    vi.mocked(productRepository.findSearchPaginated).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
    });
    vi.mocked(catalogRepository.findMatching).mockResolvedValue([]);
    vi.mocked(folderRepository.findMatching).mockResolvedValue([]);
  });

  it("devuelve catálogos, secciones y productos para una búsqueda global", async () => {
    const catalog = createCatalogFixture({ id: "catalog-1", name: "Bombas" });
    const folder = createFolderFixture({ id: "folder-1", catalogId: catalog.id, name: "Centrífugas" });

    vi.mocked(folderRepository.findAccessibleIds).mockResolvedValue([folder.id]);
    vi.mocked(catalogRepository.findMatching).mockResolvedValue([
      { id: catalog.id, name: catalog.name, description: catalog.description },
    ]);
    vi.mocked(folderRepository.findMatching).mockResolvedValue([
      {
        id: folder.id,
        name: folder.name,
        description: folder.description,
        catalogId: catalog.id,
        catalog: { id: catalog.id, name: catalog.name },
      },
    ]);
    vi.mocked(productRepository.findSearchPaginated).mockResolvedValue({
      items: [
        {
          id: "prod-1",
          folderId: folder.id,
          primaryCode: "B-100",
          normalizedCode: "B100",
          description: "Bomba de agua",
          dynamicData: { marca: "GRG" },
          indexedText: "B-100 Bomba de agua GRG",
          equivalentCodes: [],
          folder: {
            id: folder.id,
            name: folder.name,
            catalog: { id: catalog.id, name: catalog.name },
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });

    const result = await searchService.searchGlobal({
      query: "bomba",
      pageSize: 25,
    });

    expect(result.catalogs).toEqual([
      { catalogId: catalog.id, name: catalog.name, description: catalog.description },
    ]);
    expect(result.folders).toEqual([
      {
        folderId: folder.id,
        name: folder.name,
        description: folder.description,
        catalog: { id: catalog.id, name: catalog.name },
      },
    ]);
    expect(result.items).toHaveLength(1);
    expect(folderRepository.findAccessibleIds).toHaveBeenCalledTimes(1);
    expect(productRepository.findSearchPaginated).toHaveBeenCalledTimes(1);
  });

  it("no devuelve catálogos ni secciones cuando la búsqueda tiene scope", async () => {
    const catalog = createCatalogFixture({ id: "catalog-1" });
    const folder = createFolderFixture({ id: "folder-1", catalogId: catalog.id });

    vi.mocked(catalogRepository.findById).mockResolvedValue(catalog);
    vi.mocked(folderRepository.findIdsByCatalogId).mockResolvedValue([folder.id]);

    const result = await searchService.searchGlobal({
      query: "bomba",
      scope: { catalogId: catalog.id },
    });

    expect(result.catalogs).toEqual([]);
    expect(result.folders).toEqual([]);
    expect(catalogRepository.findMatching).not.toHaveBeenCalled();
    expect(folderRepository.findMatching).not.toHaveBeenCalled();
  });

  it("rechaza búsquedas globales de un solo carácter", async () => {
    await expect(searchService.searchGlobal({ query: "a" })).rejects.toThrow(
      "La consulta debe tener al menos 2 caracteres.",
    );
  });
});
