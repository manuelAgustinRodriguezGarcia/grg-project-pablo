import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PriceItemTableResponse } from "@/features/prices/types/price-item-table.types";
import { PriceItemTable } from "@/features/prices/components/PriceItemTable";

vi.mock("@/features/prices/styles/PriceNavigator.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

vi.mock("@/features/catalog/styles/CatalogNavigator.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

function createTableData(page: number): PriceItemTableResponse {
  return {
    priceList: { id: "list-1", name: "Lista" },
    columns: [
      {
        id: "col-code",
        internalKey: "codigo",
        displayName: "Código",
        originalName: "Código",
        dataType: "TEXT",
        visibleToNormalUser: true,
        isPrimaryCode: true,
        isDescription: false,
        isPrice: false,
        hasContextualHelp: false,
      },
    ],
    items: [
      {
        id: `item-${page}`,
        primaryCode: `COD-${page}`,
        description: null,
        amount: null,
        dynamicData: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    pagination: {
      page,
      pageSize: 50,
      total: 2950,
      totalPages: 59,
    },
  };
}

function renderTable(
  data: PriceItemTableResponse,
  searchQuery = "",
  onPageChange = vi.fn(),
) {
  return render(
    <PriceItemTable
      data={data}
      isLoading={false}
      error={null}
      canEdit={false}
      isAdmin={false}
      priceListId="list-1"
      searchQuery={searchQuery}
      listName=""
      listSearchResetKey="list-1"
      onSearchSubmit={vi.fn()}
      hasSelectedList
      hasAnyLists
      onPageChange={onPageChange}
      columnDetails={[]}
    />,
  );
}

describe("PriceItemTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("vuelve al inicio de la tabla al cambiar de página con los botones", () => {
    const onPageChange = vi.fn();
    const { container, rerender } = renderTable(
      createTableData(3),
      "",
      onPageChange,
    );
    const tableWrap = container.querySelector(".tableWrap") as HTMLDivElement;
    tableWrap.scrollTop = 480;

    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

    expect(onPageChange).toHaveBeenCalledWith(4);
    expect(tableWrap.scrollTop).toBe(0);

    tableWrap.scrollTop = 480;
    rerender(
      <PriceItemTable
        data={createTableData(4)}
        isLoading={false}
        error={null}
        canEdit={false}
        isAdmin={false}
        priceListId="list-1"
        searchQuery=""
        listName=""
        listSearchResetKey="list-1"
        onSearchSubmit={vi.fn()}
        hasSelectedList
        hasAnyLists
        onPageChange={onPageChange}
        columnDetails={[]}
      />,
    );

    expect(tableWrap.scrollTop).toBe(0);
  });

  it("conserva el scroll al limpiar la búsqueda interna", () => {
    const { container, rerender } = renderTable(createTableData(2), "ruleman");
    const tableWrap = container.querySelector(".tableWrap") as HTMLDivElement;
    tableWrap.scrollTop = 320;

    rerender(
      <PriceItemTable
        data={createTableData(1)}
        isLoading={false}
        error={null}
        canEdit={false}
        isAdmin={false}
        priceListId="list-1"
        searchQuery=""
        listName=""
        listSearchResetKey="list-1"
        onSearchSubmit={vi.fn()}
        hasSelectedList
        hasAnyLists
        onPageChange={vi.fn()}
        columnDetails={[]}
      />,
    );

    expect(tableWrap.scrollTop).toBe(320);
  });
});
