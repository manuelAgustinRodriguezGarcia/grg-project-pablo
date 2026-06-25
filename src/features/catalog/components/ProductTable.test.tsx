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
    search: null,
    activeFilters: [],
  };
}

describe("ProductTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra el estado de carga a pantalla completa", () => {
    render(
      <ProductTable data={null} isLoading error={null} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText("Cargando productos")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText("Tabla de productos")).toHaveAttribute("aria-busy", "true");
  });

  it("muestra el estado vacío centrado con icono", () => {
    const data = createTableData([]);

    const { container } = render(
      <ProductTable data={data} isLoading={false} error={null} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText("No hay productos en esta carpeta.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(container.querySelector(".tableEmptyIcon")).toBeInTheDocument();
    expect(container.querySelector(".productTable")).toBeNull();
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
        imagesByColumnKey: {},
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
        imagesByColumnKey: {},
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
        imagesByColumnKey: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "product-2",
        primaryCode: "6206",
        description: "Sin imagen",
        dynamicData: {},
        primaryImage: null,
        imagesByColumnKey: {},
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
        imagesByColumnKey: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "product-2",
        primaryCode: "6206",
        description: "Sin imagen",
        dynamicData: {},
        primaryImage: null,
        imagesByColumnKey: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(<ProductTable data={data} isLoading={false} error={null} onPageChange={vi.fn()} />);

    expect(screen.getAllByText("—")).toHaveLength(1);
  });

  it("oculta la columna de códigos generados por importación", () => {
    const data: ProductTableResponse = {
      ...createTableData([]),
      columns: [
        {
          id: "col-generated",
          folderId: "folder-1",
          originalName: "Código",
          displayName: "Código",
          internalKey: "codigo_generado",
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
        {
          id: "col-detalle",
          folderId: "folder-1",
          originalName: "DETALLE",
          displayName: "DETALLE",
          internalKey: "detalle",
          dataType: "TEXT",
          order: 1,
          isPrimaryCode: false,
          isDescription: false,
          isImageCode: false,
          isSearchable: false,
          isFilterable: false,
          visibleToNormalUser: true,
          isGloballySearchable: false,
          isGloballyFilterable: false,
          globalFieldKey: null,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ],
      products: [
        {
          id: "product-1",
          primaryCode: "a1b2c3",
          description: null,
          dynamicData: { detalle: "Producto A" },
          primaryImage: null,
          imagesByColumnKey: {},
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
      },
    };

    render(<ProductTable data={data} isLoading={false} error={null} onPageChange={vi.fn()} />);

    expect(screen.queryByRole("columnheader", { name: "Código" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "DETALLE" })).toBeInTheDocument();
    expect(screen.getByText("Producto A")).toBeInTheDocument();
  });

  it("renders images inside their mapped column instead of the global image column", () => {
    const data: ProductTableResponse = {
      ...createTableData([]),
      columns: [
        {
          id: "col-1",
          folderId: "folder-1",
          originalName: "Foto",
          displayName: "Foto",
          internalKey: "foto",
          dataType: "TEXT",
          order: 0,
          isPrimaryCode: false,
          isDescription: false,
          isImageCode: false,
          isSearchable: false,
          isFilterable: false,
          visibleToNormalUser: true,
          isGloballySearchable: false,
          isGloballyFilterable: false,
          globalFieldKey: null,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ],
      products: [
        {
          id: "product-1",
          primaryCode: "6205",
          description: "Ruleman",
          dynamicData: { foto: "Texto del campo" },
          primaryImage: {
            id: "image-1",
            thumbnailUrl: "https://example.com/thumb.jpg",
            fullUrl: "https://example.com/full.jpg",
          },
          imagesByColumnKey: {
            foto: [
              {
                id: "image-1",
                thumbnailUrl: "https://example.com/thumb.jpg",
                fullUrl: "https://example.com/full.jpg",
              },
            ],
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
      },
    };

    const { container } = render(
      <ProductTable data={data} isLoading={false} error={null} onPageChange={vi.fn()} />,
    );

    expect(screen.queryByRole("columnheader", { name: "Imagen" })).not.toBeInTheDocument();
    expect(screen.getByText("Texto del campo")).toBeInTheDocument();
    expect(container.querySelector(".tableCellThumb")).toHaveAttribute(
      "src",
      "https://example.com/thumb.jpg",
    );
  });
});
