import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductTableResponse } from "@/features/catalog/types/product-table.types";
import { ProductTable } from "./ProductTable";

vi.mock("@/features/catalog/styles/CatalogNavigator.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

function createTableData(
  products: ProductTableResponse["products"],
): ProductTableResponse {
  return {
    folder: { id: "folder-1", name: "Rodamientos", catalogId: "catalog-1" },
    columns: [
      {
        id: "col-1",
        folderId: "folder-1",
        originalName: "Código",
        displayName: "Código",
        internalKey: "codigo",
        dataType: "TEXT",
        order: 0,
        isPrimaryCode: true,
        isDescription: false,
        isImageCode: false,
        isSearchable: true,
        isFilterable: false,
        visibleToNormalUser: true,
        isGloballySearchable: false,
        isGloballyFilterable: false,
        globalFieldKey: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ],
    products,
    pagination: {
      page: 1,
      pageSize: 25,
      total: products.length,
      totalPages: 1,
    },
  };
}

describe("ProductTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a thumbnail when primaryImage is available", () => {
    const data = createTableData([
      {
        id: "product-1",
        primaryCode: "6205",
        description: "Ruleman",
        dynamicData: {},
        primaryImage: {
          id: "image-1",
          thumbnailUrl: "https://example.com/thumb.jpg",
          fullUrl: "https://example.com/full.jpg",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const { container } = render(
      <ProductTable data={data} isLoading={false} error={null} onPageChange={vi.fn()} />,
    );

    expect(within(container).getByRole("columnheader", { name: "Imagen" })).toBeInTheDocument();
    expect(container.querySelector(".tableThumb")).toHaveAttribute(
      "src",
      "https://example.com/thumb.jpg",
    );
  });

  it("opens a preview modal when clicking a thumbnail", () => {
    const data = createTableData([
      {
        id: "product-1",
        primaryCode: "6205",
        description: "Ruleman",
        dynamicData: {},
        primaryImage: {
          id: "image-1",
          thumbnailUrl: "https://example.com/thumb.jpg",
          fullUrl: "https://example.com/full.jpg",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(<ProductTable data={data} isLoading={false} error={null} onPageChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /ver imagen de 6205/i }));

    const dialog = screen.getByRole("dialog", { name: "6205 — Ruleman" });
    expect(within(dialog).getByRole("img", { name: "6205 — Ruleman" })).toHaveAttribute(
      "src",
      "https://example.com/full.jpg",
    );
  });

  it("does not open a preview modal when the row has no image", () => {
    const data = createTableData([
      {
        id: "product-1",
        primaryCode: "6205",
        description: "Con imagen",
        dynamicData: {},
        primaryImage: {
          id: "image-1",
          thumbnailUrl: "https://example.com/thumb.jpg",
          fullUrl: null,
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "product-2",
        primaryCode: "6206",
        description: "Sin imagen",
        dynamicData: {},
        primaryImage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(<ProductTable data={data} isLoading={false} error={null} onPageChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /ver imagen de 6206/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ver imagen de 6205/i }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("shows an empty placeholder when the image column is visible but a row has no thumbnail", () => {
    const data = createTableData([
      {
        id: "product-1",
        primaryCode: "6205",
        description: "Con imagen",
        dynamicData: {},
        primaryImage: {
          id: "image-1",
          thumbnailUrl: "https://example.com/thumb.jpg",
          fullUrl: null,
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "product-2",
        primaryCode: "6206",
        description: "Sin imagen",
        dynamicData: {},
        primaryImage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(<ProductTable data={data} isLoading={false} error={null} onPageChange={vi.fn()} />);

    expect(screen.getAllByText("—")).toHaveLength(1);
  });

  it("does not render the image column when no product has primaryImage", () => {
    const data = createTableData([
      {
        id: "product-1",
        primaryCode: "6205",
        description: "Ruleman",
        dynamicData: {},
        primaryImage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const { container } = render(
      <ProductTable data={data} isLoading={false} error={null} onPageChange={vi.fn()} />,
    );

    expect(screen.queryByRole("columnheader", { name: "Imagen" })).not.toBeInTheDocument();
    expect(container.querySelector(".tableThumb")).toBeNull();
  });
});
