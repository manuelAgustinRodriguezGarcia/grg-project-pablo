import { describe, expect, it } from "vitest";
import { extractCellValue, toParsedFormula } from "@/server/importers/excel-cell.extractor";

describe("excel-cell.extractor", () => {
  it("extrae valor de texto plano", () => {
    const result = extractCellValue({ value: "6205" } as never);
    expect(result.displayValue).toBe("6205");
    expect(result.hasCachedValue).toBe(true);
  });

  it("extrae fórmula con valor cacheado", () => {
    const result = extractCellValue({
      value: { formula: "12*25.4", result: 304.8 },
      formula: "12*25.4",
      result: 304.8,
    } as never);

    expect(result.formula).toBe("12*25.4");
    expect(result.displayValue).toBe(304.8);
    expect(result.hasCachedValue).toBe(true);

    const parsed = toParsedFormula("precio", result);
    expect(parsed?.hasCachedValue).toBe(true);
  });

  it("marca fórmula sin valor cacheado", () => {
    const result = extractCellValue({
      value: { formula: "A1+B1" },
      formula: "A1+B1",
    } as never);

    expect(result.hasCachedValue).toBe(false);
    const parsed = toParsedFormula("total", result);
    expect(parsed?.hasCachedValue).toBe(false);
  });
});
