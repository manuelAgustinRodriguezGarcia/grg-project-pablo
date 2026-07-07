import { describe, expect, it } from "vitest";
import { formatImportMetrics } from "@/features/files/utils/format-destination-summary";
import type { UploadedFileLatestJobSummary } from "@/features/files/types/uploaded-file.types";

function buildLatestJob(
  overrides: Partial<UploadedFileLatestJobSummary>,
): UploadedFileLatestJobSummary {
  return {
    id: "job-1",
    status: "PUBLISHED",
    destinationType: "CATALOG_FOLDER",
    catalog: null,
    folder: null,
    priceList: null,
    actionType: "IMPORTAR_LISTA",
    finishedAt: "2026-07-06T00:00:00.000Z",
    sheetsDetected: 1,
    sheetImported: "Hoja1",
    productsCreated: 0,
    productsSkipped: 0,
    itemsProcessed: 0,
    errorCount: 0,
    ...overrides,
  };
}

describe("formatImportMetrics", () => {
  it("muestra productos creados para importaciones de catálogo", () => {
    const result = formatImportMetrics(
      buildLatestJob({
        destinationType: "CATALOG_FOLDER",
        productsCreated: 42,
        productsSkipped: 3,
      }),
    );

    expect(result).toBe("42 creados · 3 omitidos");
  });

  it("muestra filas para importaciones de lista de precios", () => {
    const result = formatImportMetrics(
      buildLatestJob({
        destinationType: "PRICE_LIST",
        priceList: { id: "pl-1", name: "Lista 2024" },
        itemsProcessed: 128,
        productsCreated: 120,
        productsSkipped: 8,
      }),
    );

    expect(result).toBe("128 filas · 8 omitidas");
  });

  it("usa creados + omitidos si no hay itemsProcessed en precios", () => {
    const result = formatImportMetrics(
      buildLatestJob({
        destinationType: "PRICE_LIST",
        itemsProcessed: 0,
        productsCreated: 50,
        productsSkipped: 10,
      }),
    );

    expect(result).toBe("60 filas · 10 omitidas");
  });
});
