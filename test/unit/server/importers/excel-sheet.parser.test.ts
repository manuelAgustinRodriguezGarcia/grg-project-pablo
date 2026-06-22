import { describe, expect, it } from "vitest";
import { parseWorkbookFromBuffer } from "@/server/importers/excel-workbook.parser";
import { createMinimalWorkbookBuffer } from "../../../fixtures/minimal-workbook";

describe("excel-sheet.parser", () => {
  it("parsea hojas y clasifica correctamente", async () => {
    const buffer = await createMinimalWorkbookBuffer();
    const workbook = await parseWorkbookFromBuffer(buffer);

    expect(workbook.sheets).toHaveLength(3);

    const rodamientos = workbook.sheets.find((sheet) => sheet.sheetName === "Rodamientos");
    expect(rodamientos?.classification).toBe("IMPORTABLE");
    expect(rodamientos?.headers).toHaveLength(3);
    expect(rodamientos?.rows).toHaveLength(2);
    expect(rodamientos?.rows[0]?.cells.codigo).toBe("6205");

    const indice = workbook.sheets.find((sheet) => sheet.sheetName === "Índice");
    expect(indice?.classification).toBe("INDEX");

    const ignored = workbook.sheets.find((sheet) => sheet.sheetName === "Sheet1");
    expect(ignored?.classification).toBe("IGNORED");
  });
});
