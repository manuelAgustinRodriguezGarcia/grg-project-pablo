import { describe, expect, it } from "vitest";
import { mapSheetToProducts } from "@/server/importers/product-row.mapper";
import type { ParsedSheet } from "@/server/importers/types";
import { createColumnFixture } from "../../../helpers/fixtures/column.fixture";

function createSheet(): ParsedSheet {
  return {
    sheetName: "Hoja1",
    classification: "IMPORTABLE",
    classificationReason: "ok",
    headerRow: 1,
    headers: [
      {
        originalName: "Detalle",
        internalKey: "detalle",
        columnIndex: 0,
        inferredDataType: "TEXT",
      },
      {
        originalName: "Código imagen",
        internalKey: "codigo_imagen",
        columnIndex: 1,
        inferredDataType: "TEXT",
      },
    ],
    rows: [
      {
        rowNumber: 2,
        cells: {
          detalle: "Producto A",
          codigo_imagen: "IMG-001",
        },
        originalText: "Producto A IMG-001",
        formulas: [],
        warnings: [],
      },
      {
        rowNumber: 3,
        cells: {
          detalle: "Producto B",
          codigo_imagen: "IMG-002",
        },
        originalText: "Producto B IMG-002",
        formulas: [],
        warnings: [],
      },
    ],
    rowCount: 2,
    columnCount: 2,
    imageCount: 0,
    imagesByRow: {},
  };
}

describe("mapSheetToProducts", () => {
  it("asigna códigos generados cuando useGeneratedPrimaryCodes está activo", () => {
    const sheet = createSheet();
    const columns = [
      createColumnFixture({
        internalKey: "detalle",
        originalName: "Detalle",
        isPrimaryCode: false,
      }),
      createColumnFixture({
        internalKey: "codigo_imagen",
        originalName: "Código imagen",
        isImageCode: true,
      }),
    ];

    const products = mapSheetToProducts(sheet, columns, {
      useGeneratedPrimaryCodes: true,
      columnMapping: [
        { headerInternalKey: "detalle", folderColumnInternalKey: "detalle" },
        {
          headerInternalKey: "codigo_imagen",
          folderColumnInternalKey: "codigo_imagen",
        },
      ],
    });

    expect(products).toHaveLength(2);
    expect(products[0]?.primaryCode).toMatch(/^[0-9a-f]{6}$/);
    expect(products[1]?.primaryCode).toMatch(/^[0-9a-f]{6}$/);
    expect(products[0]?.primaryCode).not.toBe(products[1]?.primaryCode);
    expect(products[0]?.dynamicData).toEqual({
      detalle: "Producto A",
      codigo_imagen: "IMG-001",
    });
    expect(products[1]?.dynamicData).toEqual({
      detalle: "Producto B",
      codigo_imagen: "IMG-002",
    });
  });

  it("usa la columna configurada cuando no se generan códigos", () => {
    const sheet = createSheet();
    const columns = [
      createColumnFixture({
        internalKey: "detalle",
        originalName: "Detalle",
        isPrimaryCode: true,
      }),
      createColumnFixture({
        internalKey: "codigo_imagen",
        originalName: "Código imagen",
        isImageCode: true,
      }),
    ];

    const products = mapSheetToProducts(sheet, columns, {
      primaryCodeColumnKey: "detalle",
      columnMapping: [
        { headerInternalKey: "detalle", folderColumnInternalKey: "detalle" },
        {
          headerInternalKey: "codigo_imagen",
          folderColumnInternalKey: "codigo_imagen",
        },
      ],
    });

    expect(products[0]?.primaryCode).toBe("Producto A");
    expect(products[0]?.dynamicData).toEqual({ codigo_imagen: "IMG-001" });
  });
});
