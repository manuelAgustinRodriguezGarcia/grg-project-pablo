import { describe, expect, it } from "vitest";
import { buildGlobalSearchDropdownOptions } from "@/features/catalog/components/CatalogGlobalSearchDropdown";
import type { GlobalSearchResponse } from "@/features/catalog/types/global-search.types";
import {
  formatProductFolderResultCount,
  formatProductFolderResultLabel,
  groupSearchResultsByFolder,
} from "@/features/catalog/utils/group-search-results-by-folder";

const sampleResponse: GlobalSearchResponse = {
  search: { query: "ab", normalizedQuery: "ab" },
  catalogs: [
    { catalogId: "c1", name: "Catálogo A", description: null },
  ],
  folders: [
    {
      folderId: "f1",
      name: "Carpeta A",
      description: null,
      catalog: { id: "c1", name: "Catálogo A" },
    },
  ],
  items: [
    {
      productId: "p1",
      primaryCode: "AB-1",
      description: "Producto 1",
      matchType: "primaryCode",
      matchValue: "AB-1",
      catalog: { id: "c1", name: "Catálogo A" },
      folder: { id: "f1", name: "Carpeta A" },
      primaryImage: null,
    },
    {
      productId: "p2",
      primaryCode: "AB-2",
      description: "Producto 2",
      matchType: "description",
      matchValue: "ab",
      catalog: { id: "c1", name: "Catálogo A" },
      folder: { id: "f1", name: "Carpeta A" },
      primaryImage: {
        id: "img1",
        thumbnailUrl: "https://example.com/thumb.webp",
        fullUrl: null,
      },
    },
    {
      productId: "p3",
      primaryCode: "XY-1",
      description: "Otro",
      matchType: "indexedText",
      matchValue: "ab",
      catalog: { id: "c2", name: "Catálogo B" },
      folder: { id: "f2", name: "Carpeta B" },
      primaryImage: null,
    },
  ],
  pagination: { page: 1, pageSize: 8, total: 3, totalPages: 1 },
};

describe("groupSearchResultsByFolder", () => {
  it("groups products by folder id", () => {
    const groups = groupSearchResultsByFolder(sampleResponse.items);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      folderId: "f1",
      folderName: "Carpeta A",
      catalogName: "Catálogo A",
    });
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].items).toHaveLength(1);
  });
});

describe("formatProductFolderResultLabel", () => {
  it("formats singular and plural labels", () => {
    expect(formatProductFolderResultLabel(1, "Alternadores", "ALTERNADORES")).toBe(
      "1 resultado en Alternadores | Catálogo: ALTERNADORES",
    );
    expect(formatProductFolderResultLabel(5, "Alternadores", "ALTERNADORES")).toBe(
      "5 resultados en Alternadores | Catálogo: ALTERNADORES",
    );
  });
});

describe("formatProductFolderResultCount", () => {
  it("formats the folder result line without catalog", () => {
    expect(formatProductFolderResultCount(8, "Alternadores")).toBe(
      "8 resultados en Alternadores",
    );
  });
});

describe("buildGlobalSearchDropdownOptions", () => {
  it("returns empty list for null data", () => {
    expect(buildGlobalSearchDropdownOptions(null)).toEqual([]);
  });

  it("orders folders then product-folder groups and ignores catalogs", () => {
    const options = buildGlobalSearchDropdownOptions(sampleResponse);
    expect(options.map((option) => option.kind)).toEqual([
      "folder",
      "productFolder",
      "productFolder",
    ]);
    expect(options.map((option) => option.key)).toEqual([
      "folder:f1",
      "product-folder:f1",
      "product-folder:f2",
    ]);
  });
});
