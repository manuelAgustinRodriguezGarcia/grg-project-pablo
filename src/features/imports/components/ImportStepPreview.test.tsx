import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportStepPreview } from "@/features/imports/components/ImportStepPreview";
import type { ImportPreviewResponse } from "@/features/imports/types/import-job.types";

vi.mock("./ImportWizard.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

function createPreview(repeatedColumns: string[]): ImportPreviewResponse {
  return {
    summary: {
      totalProducts: 10,
      matchedCount: 0,
      imageCount: 0,
      embeddedImagesDetected: 0,
      rowsWithEmbeddedImages: 0,
      productsWithMultipleEmbeddedImages: 0,
      columnCount: 3,
      folderProductCount: 0,
      folderIsEmpty: true,
      formulasDetected: 0,
      formulasWithoutCachedValue: 0,
      repeatedColumns,
    },
    products: [],
    matchedProducts: [],
    warnings: [],
    errors: [],
    pagination: {
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 0,
    },
  };
}

describe("ImportStepPreview", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra solo las columnas repetidas cuando existen", () => {
    render(
      <ImportStepPreview
        preview={createPreview(["DETALLE", "MARCA"])}
        catalogName="Catálogo"
        folderName="Carpeta"
        sheetName="Hoja1"
        selectedAction={null}
        onSelectAction={vi.fn()}
      />,
    );

    expect(screen.getByText("Columnas repetidas")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Columna repetida" })).toBeInTheDocument();
    expect(screen.getByText("DETALLE")).toBeInTheDocument();
    expect(screen.getByText("MARCA")).toBeInTheDocument();
  });

  it("oculta la tabla cuando no hay columnas repetidas", () => {
    render(
      <ImportStepPreview
        preview={createPreview([])}
        catalogName="Catálogo"
        folderName="Carpeta"
        sheetName="Hoja1"
        selectedAction={null}
        onSelectAction={vi.fn()}
      />,
    );

    expect(screen.queryByText("Columnas repetidas")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("muestra combinar y reemplazar cuando la lista de precios tiene ítems", () => {
    render(
      <ImportStepPreview
        preview={{
          ...createPreview([]),
          summary: {
            totalItems: 25,
            matchedCount: 3,
            columnCount: 4,
            priceListItemCount: 80,
            priceListIsEmpty: false,
            formulasDetected: 0,
            formulasWithoutCachedValue: 0,
          },
        }}
        mode="PRICE_LIST"
        catalogName=""
        folderName=""
        priceListName="Lista mayorista"
        sheetName="Precios"
        selectedAction={null}
        onSelectAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Combinar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reemplazar/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Mantiene los 80 ítems actuales y agrega solo los nuevos/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Borra los 80 ítems actuales y los sustituye por la nueva lista/),
    ).toBeInTheDocument();
    expect(screen.getByText(/lista de precios/)).toBeInTheDocument();
    expect(screen.getByText(/Lista mayorista/)).toBeInTheDocument();
  });
});
