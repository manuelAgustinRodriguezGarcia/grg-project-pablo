import { describe, expect, it } from "vitest";
import { buildGlobalSearchDropdownOptions } from "@/features/catalog/components/CatalogGlobalSearchDropdown";
import type { GlobalSearchResponse } from "@/features/catalog/types/global-search.types";

const sampleResponse: GlobalSearchResponse = {
  search: { query: "ab", normalizedQuery: "ab" },
  catalogs: [
    { catalogId: "c1", name: "Catálogo A", description: null },
  ],
  folders: [
    {
      folderId: "f1",
      name: "Sección A",
      description: null,
      catalog: { id: "c1", name: "Catálogo A" },
    },
  ],
  items: [
    {
      productId: "p1",
      primaryCode: "AB-1",
      description: "Producto",
      matchType: "primaryCode",
      matchValue: "AB-1",
      catalog: { id: "c1", name: "Catálogo A" },
      folder: { id: "f1", name: "Sección A" },
      primaryImage: null,
    },
  ],
  pagination: { page: 1, pageSize: 8, total: 1, totalPages: 1 },
};

describe("buildGlobalSearchDropdownOptions", () => {
  it("returns empty list for null data", () => {
    expect(buildGlobalSearchDropdownOptions(null)).toEqual([]);
  });

  it("orders catalogs, folders, then products", () => {
    const options = buildGlobalSearchDropdownOptions(sampleResponse);
    expect(options.map((option) => option.kind)).toEqual([
      "catalog",
      "folder",
      "product",
    ]);
    expect(options.map((option) => option.key)).toEqual([
      "catalog:c1",
      "folder:f1",
      "product:p1",
    ]);
  });
});
