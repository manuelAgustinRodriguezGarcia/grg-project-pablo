import { describe, expect, it } from "vitest";
import { getImportConfirmCopy } from "@/features/imports/utils/import-confirm-copy";
import type { ImportPreviewSummary } from "@/features/imports/types/import-job.types";

const priceSummary: ImportPreviewSummary = {
  totalItems: 120,
  matchedCount: 15,
  columnCount: 4,
  priceListItemCount: 80,
  priceListIsEmpty: false,
  formulasDetected: 0,
  formulasWithoutCachedValue: 0,
};

const folderSummary: ImportPreviewSummary = {
  totalProducts: 200,
  matchedCount: 10,
  columnCount: 5,
  folderProductCount: 50,
  folderIsEmpty: false,
  formulasDetected: 0,
  formulasWithoutCachedValue: 0,
};

describe("getImportConfirmCopy", () => {
  it("usa conteos de ítems en modo precios al reemplazar", () => {
    const copy = getImportConfirmCopy({
      action: "REEMPLAZAR_LISTA",
      isPriceMode: true,
      summary: priceSummary,
      destinationName: "Lista mayorista",
    });

    expect(copy.title).toBe("Reemplazar ítems");
    expect(copy.message).toContain("80 ítems actuales");
    expect(copy.message).toContain("120 ítems del Excel");
    expect(copy.message).toContain('"Lista mayorista"');
    expect(copy.confirmLabel).toBe("Reemplazar");
  });

  it("usa conteos de productos en modo catálogo al combinar", () => {
    const copy = getImportConfirmCopy({
      action: "COMBINAR_LISTA",
      isPriceMode: false,
      summary: folderSummary,
      destinationName: "Repuestos",
    });

    expect(copy.title).toBe("Combinar productos");
    expect(copy.message).toContain("50 productos actuales");
    expect(copy.message).toContain('"Repuestos"');
    expect(copy.confirmLabel).toBe("Combinar");
  });
});
