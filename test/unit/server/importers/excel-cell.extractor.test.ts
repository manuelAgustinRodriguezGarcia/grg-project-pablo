import { describe, expect, it } from "vitest";
import { extractCellValue, toParsedFormula } from "@/server/importers/excel-cell.extractor";
import { normalizeMultilineText } from "@/shared/text/normalize-multiline-text";

describe("normalizeMultilineText", () => {
  it("normaliza saltos de línea de Windows y Mac", () => {
    expect(normalizeMultilineText("a\r\nb\rc")).toBe("a\nb\nc");
  });
});

describe("excel-cell.extractor", () => {
  it("extrae valor de texto plano", () => {
    const result = extractCellValue({ value: "6205", text: "6205" } as never);
    expect(result.displayValue).toBe("6205");
    expect(result.hasCachedValue).toBe(true);
  });

  it("conserva saltos de línea en texto plano", () => {
    const multiline = "5303-SILVA\n1001346-PELLA\n1300366-SCANIA";
    const result = extractCellValue({
      value: multiline,
      text: multiline,
    } as never);

    expect(result.displayValue).toBe(multiline);
  });

  it("normaliza saltos de línea al extraer texto", () => {
    const result = extractCellValue({
      value: "5303-SILVA\r\n1001346-PELLA\r1300366-SCANIA",
      text: "5303-SILVA\r\n1001346-PELLA\r1300366-SCANIA",
    } as never);

    expect(result.displayValue).toBe("5303-SILVA\n1001346-PELLA\n1300366-SCANIA");
  });

  it("prefiere cell.text para rich text con saltos de línea", () => {
    const result = extractCellValue({
      value: {
        richText: [
          { text: "5303-SILVA\n" },
          { text: "1001346-PELLA\n" },
          { text: "1300366-SCANIA" },
        ],
      },
      text: "5303-SILVA\n1001346-PELLA\n1300366-SCANIA",
    } as never);

    expect(result.displayValue).toBe("5303-SILVA\n1001346-PELLA\n1300366-SCANIA");
  });

  it("extrae fórmula con valor cacheado", () => {
    const result = extractCellValue({
      value: { formula: "12*25.4", result: 304.8 },
      formula: "12*25.4",
      result: 304.8,
      text: "304.8",
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
      text: "",
    } as never);

    expect(result.hasCachedValue).toBe(false);
    const parsed = toParsedFormula("total", result);
    expect(parsed?.hasCachedValue).toBe(false);
  });
});
