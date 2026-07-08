import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductTableResponse } from "@/features/catalog/types/product-table.types";

vi.mock("@/features/catalog/styles/CatalogNavigator.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

vi.mock("@/features/catalog/actions/column.actions", () => ({
  updateColumnAction: vi.fn(),
  setColumnVisibilityAction: vi.fn(),
}));

vi.mock("@/features/catalog/actions/column-help.actions", () => ({
  deleteColumnHelpImageAction: vi.fn(),
}));

import { ProductTable } from "./ProductTable";

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

  it("muestra shimmer de carga con estado accesible", () => {
    render(
      <ProductTable data={null} isLoading error={null} onPageChange={vi.fn()} />,
    );

    expect(screen.getByRole("status")).toHaveAccessibleName("Cargando productos");
    expect(screen.getByLabelText("Tabla de productos")).toHaveAttribute("aria-busy", "true");
  });

  it("muestra una capa semitransparente al recargar con datos existentes", () => {
    const data = createTableData([
      {
        id: "product-1",
        primaryCode: "6205",
        description: "Ruleman",
        dynamicData: { montadora: "John Deere" },
        primaryImage: null,
        imagesByColumnKey: {},
        fieldAnnotationsByColumnKey: {},
      },
    ]);

    const { container } = render(
      <ProductTable data={data} isLoading error={null} onPageChange={vi.fn()} />,
    );

    expect(screen.getByRole("status", { name: "Actualizando productos" })).toBeInTheDocument();
    expect(screen.getByText("6205")).toBeInTheDocument();
    expect(container.querySelector(".tableRefreshOverlay")).toBeInTheDocument();
    expect(container.querySelector(".tableWrapRefreshing")).toBeInTheDocument();
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
        fieldAnnotationsByColumnKey: {},
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

  it("opens a preview modal when clicking a thumbnail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: "https://example.com/full.jpg" }),
      }),
    );

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
        fieldAnnotationsByColumnKey: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(<ProductTable data={data} isLoading={false} error={null} onPageChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /ver imagen de 6205/i }));

    const dialog = screen.getByRole("dialog", { name: "6205 — Ruleman" });
    await waitFor(() => {
      expect(within(dialog).getByRole("img", { name: "6205 — Ruleman" })).toHaveAttribute(
        "src",
        "https://example.com/full.jpg",
      );
    });
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
        fieldAnnotationsByColumnKey: {},
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
        fieldAnnotationsByColumnKey: {},
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
        fieldAnnotationsByColumnKey: {},
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
        fieldAnnotationsByColumnKey: {},
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
        fieldAnnotationsByColumnKey: {},
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

  it("muestra el menú de filtro en columnas filtrables cuando está habilitado", () => {
    const data: ProductTableResponse = {
      ...createTableData([]),
      columns: [
        {
          id: "col-1",
          folderId: "folder-1",
          originalName: "Montadora",
          displayName: "Montadora",
          internalKey: "montadora",
          dataType: "TEXT",
          order: 0,
          isPrimaryCode: false,
          isDescription: false,
          isImageCode: false,
          isSearchable: false,
          isFilterable: true,
          visibleToNormalUser: true,
          isGloballySearchable: false,
          isGloballyFilterable: false,
          globalFieldKey: null,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
        {
          id: "col-2",
          folderId: "folder-1",
          originalName: "Obs",
          displayName: "Obs",
          internalKey: "obs",
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
          primaryCode: "6205",
          description: "Ruleman",
          dynamicData: { montadora: "John Deere", obs: "35" },
          primaryImage: null,
          imagesByColumnKey: {},
        fieldAnnotationsByColumnKey: {},
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
      activeFilters: [
        {
          id: "montadora",
          columnInternalKey: "montadora",
          columnDisplayName: "Montadora",
          operator: "contains",
          value: "John",
          label: 'Montadora: "John"',
        },
      ],
    };

    render(
      <ProductTable
        data={data}
        isLoading={false}
        error={null}
        onPageChange={vi.fn()}
        enableColumnFilters
        columnFilters={[
          {
            columnInternalKey: "montadora",
            operator: "contains",
            value: "John",
          },
        ]}
        onColumnFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Montadora")).toBeInTheDocument();
    expect(screen.getByText("Obs")).toBeInTheDocument();
    expect(screen.getByText('Montadora: "John"')).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByText("Obs"));

    expect(screen.getByRole("dialog", { name: "Filtro de Obs" })).toBeInTheDocument();
    expect(screen.getByLabelText("Valor de filtro para Obs")).toBeInTheDocument();
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
          fieldAnnotationsByColumnKey: {},
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

  it("muestra anotación de campo debajo del valor", () => {
    const data = createTableData([
      {
        id: "product-1",
        primaryCode: "6205",
        description: "Ruleman",
        dynamicData: { anclaje_frente: "Delantero" },
        primaryImage: null,
        imagesByColumnKey: {},
        fieldAnnotationsByColumnKey: {
          anclaje_frente: {
            helpText: "Diagrama de montaje",
            thumbnailUrl: "https://example.com/annotation-thumb.jpg",
            fullUrl: "https://example.com/annotation-full.jpg",
          },
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    data.columns.push({
      id: "col-2",
      folderId: "folder-1",
      originalName: "Anclaje frente",
      displayName: "Anclaje frente",
      internalKey: "anclaje_frente",
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
      isAdminEditable: true,
      isEquivalence: false,
      isRequired: false,
      isReadOnly: false,
      width: null,
      format: null,
      unit: null,
      label: null,
      globalFieldKey: null,
      helpText: null,
      helpImageAltText: null,
      hasContextualHelp: false,
      helpImagePreviewUrl: null,
      helpImageFullUrl: null,
      createdAt: new Date("2026-01-01").toISOString(),
      updatedAt: new Date("2026-01-01").toISOString(),
    });

    const { container } = render(
      <ProductTable data={data} isLoading={false} error={null} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText("Delantero")).toBeInTheDocument();
    expect(screen.getByText("Diagrama de montaje")).toBeInTheDocument();
    expect(container.querySelector(".tableCellThumb")).toHaveAttribute(
      "src",
      "https://example.com/annotation-thumb.jpg",
    );
  });

  it("no muestra guion vacio cuando solo hay imagen de campo", () => {
    const data = createTableData([
      {
        id: "product-1",
        primaryCode: "6205",
        description: "Ruleman",
        dynamicData: { anclaje_frente: "" },
        primaryImage: null,
        imagesByColumnKey: {},
        fieldAnnotationsByColumnKey: {
          anclaje_frente: {
            helpText: null,
            thumbnailUrl: "https://example.com/annotation-thumb.jpg",
            fullUrl: "https://example.com/annotation-full.jpg",
          },
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    data.columns.push({
      id: "col-2",
      folderId: "folder-1",
      originalName: "Anclaje frente",
      displayName: "Anclaje frente",
      internalKey: "anclaje_frente",
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
      isAdminEditable: true,
      isEquivalence: false,
      isRequired: false,
      isReadOnly: false,
      width: null,
      format: null,
      unit: null,
      label: null,
      globalFieldKey: null,
      helpText: null,
      helpImageAltText: null,
      hasContextualHelp: false,
      helpImagePreviewUrl: null,
      helpImageFullUrl: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });

    render(<ProductTable data={data} isLoading={false} error={null} onPageChange={vi.fn()} />);

    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ver imagen de ayuda de Anclaje frente")).toBeInTheDocument();
  });
});
