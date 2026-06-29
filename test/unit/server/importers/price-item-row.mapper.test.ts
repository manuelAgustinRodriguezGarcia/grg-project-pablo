import { describe, expect, it } from "vitest";
import type { PriceColumn } from "@/generated/prisma/client";
import { mapSheetToPriceItems } from "@/server/importers/price-item-row.mapper";
import type { ParsedSheet } from "@/server/importers/types";

const baseColumn: PriceColumn = {
  id: "col-1",
  priceListId: "pl-1",
  originalName: "Código",
  displayName: "Código",
  internalKey: "codigo",
  dataType: "TEXT",
  order: 0,
  visibleToNormalUser: true,
  isSearchable: true,
  isFilterable: false,
  isAdminEditable: true,
  isPrimaryCode: true,
  isDescription: false,
  isPrice: false,
  isRequired: false,
  isReadOnly: false,
  width: null,
  format: null,
  unit: null,
  label: null,
  helpText: null,
  helpImagePath: null,
  helpImageThumbnailPath: null,
  helpImageMimeType: null,
  helpImageSizeBytes: null,
  helpImageOriginalName: null,
  helpImageAltText: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const priceColumn: PriceColumn = {
  ...baseColumn,
  id: "col-2",
  originalName: "Precio",
  displayName: "Precio",
  internalKey: "precio",
  isPrimaryCode: false,
  isPrice: true,
  dataType: "NUMBER",
};

const sheet: ParsedSheet = {
  sheetName: "Hoja1",
  classification: "IMPORTABLE",
  classificationReason: "data",
  headerRow: 1,
  rowCount: 1,
  columnCount: 2,
  headers: [
    {
      originalName: "Código",
      internalKey: "codigo",
      columnIndex: 0,
      inferredDataType: "TEXT",
    },
    {
      originalName: "Precio",
      internalKey: "precio",
      columnIndex: 1,
      inferredDataType: "NUMBER",
    },
  ],
  rows: [
    {
      rowNumber: 2,
      cells: {
        codigo: "ABC-123",
        precio: "1500.50",
      },
      originalText: "ABC-123 1500.50",
      formulas: [],
      warnings: [],
    },
  ],
  embeddedImageSummary: {
    embeddedImagesDetected: 0,
    rowsWithEmbeddedImages: 0,
    productsWithMultipleEmbeddedImages: 0,
  },
  imageCount: 0,
};

describe("mapSheetToPriceItems", () => {
  it("mapea código y precio desde fila Excel", () => {
    const items = mapSheetToPriceItems(sheet, [baseColumn, priceColumn], {});

    expect(items).toHaveLength(1);
    expect(items[0]?.primaryCode).toBe("ABC-123");
    expect(items[0]?.normalizedCode).toBe("ABC123");
    expect(items[0]?.amount).toBe("1500.5");
  });
});
