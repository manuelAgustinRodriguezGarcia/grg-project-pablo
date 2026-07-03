import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogGlobalSearchResults } from "./CatalogGlobalSearchResults";
import type { GlobalSearchResponse } from "@/features/catalog/types/global-search.types";

afterEach(() => {
  cleanup();
});

const sampleData: GlobalSearchResponse = {
  search: {
    query: "abc",
    normalizedQuery: "abc",
  },
  catalogs: [
    {
      catalogId: "cat-1",
      name: "Catálogo A",
      description: "Catálogo principal",
    },
  ],
  folders: [
    {
      folderId: "folder-1",
      name: "Carpeta 1",
      description: "Sección principal",
      catalog: { id: "cat-1", name: "Catálogo A" },
    },
  ],
  items: [
    {
      productId: "prod-1",
      primaryCode: "ABC-001",
      description: "Producto de prueba",
      matchType: "primaryCode",
      matchValue: "ABC-001",
      catalog: { id: "cat-1", name: "Catálogo A" },
      folder: { id: "folder-1", name: "Carpeta 1" },
      primaryImage: null,
    },
  ],
  pagination: {
    page: 1,
    pageSize: 25,
    total: 1,
    totalPages: 1,
  },
};

describe("CatalogGlobalSearchResults", () => {
  it("shows loading skeleton when fetching without cached data", () => {
    render(
      <CatalogGlobalSearchResults
        data={null}
        searchQuery="abc"
        isLoading
        error={null}
        onPageChange={vi.fn()}
        onSelectCatalog={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectResult={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Resultados de búsqueda global")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("shows empty state when there are no matches", () => {
    render(
      <CatalogGlobalSearchResults
        data={{
          ...sampleData,
          catalogs: [],
          folders: [],
          items: [],
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
        }}
        searchQuery="inexistente"
        isLoading={false}
        error={null}
        onPageChange={vi.fn()}
        onSelectCatalog={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectResult={vi.fn()}
      />,
    );

    expect(screen.getByText(/Sin resultados para «inexistente»/)).toBeInTheDocument();
  });

  it("renders rows and notifies selection", () => {
    const onSelectResult = vi.fn();
    const onSelectCatalog = vi.fn();
    const onSelectFolder = vi.fn();

    render(
      <CatalogGlobalSearchResults
        data={sampleData}
        searchQuery="abc"
        isLoading={false}
        error={null}
        onPageChange={vi.fn()}
        onSelectCatalog={onSelectCatalog}
        onSelectFolder={onSelectFolder}
        onSelectResult={onSelectResult}
      />,
    );

    expect(screen.getByRole("button", { name: "ABC-001" })).toBeInTheDocument();
    expect(screen.getAllByText("Catálogo A")).toHaveLength(2);
    expect(screen.getAllByText("Carpeta 1")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "ABC-001" }));
    fireEvent.click(
      screen.getByRole("button", { name: /CatálogoCatálogo ACatálogo principal/ }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /SecciónCarpeta 1Catálogo A · Sección principal/,
      }),
    );

    expect(onSelectResult).toHaveBeenCalledWith(sampleData.items[0]);
    expect(onSelectCatalog).toHaveBeenCalledWith("cat-1");
    expect(onSelectFolder).toHaveBeenCalledWith("cat-1", "folder-1");
  });
});
