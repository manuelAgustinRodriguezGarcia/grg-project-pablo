import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseWorkbookFromBuffer } from "@/server/importers/excel-workbook.parser";
import { createMinimalWorkbookBuffer } from "../../../fixtures/minimal-workbook";

async function createWorkbookBuffer(
  configure: (workbook: ExcelJS.Workbook) => void,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  configure(workbook);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

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

  it("omite columnas sin nombre y sin datos", async () => {
    const buffer = await createWorkbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("Con columna vacía");
      sheet.addRow(["", "Código", "Marca"]);
      sheet.addRow(["", "6205", "SKF"]);
      sheet.addRow(["", "6206", "FAG"]);
    });

    const workbook = await parseWorkbookFromBuffer(buffer);
    const sheet = workbook.sheets[0];

    expect(sheet?.headers.map((header) => header.originalName)).toEqual([
      "Código",
      "Marca",
    ]);
    expect(sheet?.headers.map((header) => header.columnIndex)).toEqual([1, 2]);
  });

  it("importa columnas sin nombre cuando tienen al menos un valor", async () => {
    const buffer = await createWorkbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("Columna sin nombre con datos");
      sheet.addRow(["", "Código", "Marca"]);
      sheet.addRow(["REF-01", "6205", "SKF"]);
      sheet.addRow(["", "6206", "FAG"]);
    });

    const workbook = await parseWorkbookFromBuffer(buffer);
    const sheet = workbook.sheets[0];

    expect(sheet?.headers.map((header) => header.originalName)).toEqual([
      "Columna 1",
      "Código",
      "Marca",
    ]);
    expect(sheet?.rows[0]?.cells.columna_1).toBe("REF-01");
    expect(sheet?.rows[1]?.cells.columna_1).toBe("");
  });

  it("omite la columna A vacía cuando los encabezados empiezan en B", async () => {
    const buffer = await createWorkbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("RODAMIENTOS");
      sheet.addRow([
        "",
        "BUSCAR",
        "NÚMERO",
        "EQUIVALENTE",
        "RUBRO",
      ]);
      sheet.addRow(["", "x", "6205", "SKF", "Rulemanes"]);
      sheet.addRow(["", "", "6206", "FAG", "Rulemanes"]);
    });

    const workbook = await parseWorkbookFromBuffer(buffer);
    const sheet = workbook.sheets[0];

    expect(sheet?.headers.map((header) => header.originalName)).toEqual([
      "BUSCAR",
      "NÚMERO",
      "EQUIVALENTE",
      "RUBRO",
    ]);
    expect(sheet?.headers.some((header) => header.columnIndex === 0)).toBe(false);
  });

  it("importa hojas con nombre genérico cuando tienen datos tabulares", async () => {
    const buffer = await createWorkbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("Hoja1");
      sheet.addRow(["Código", "Descripción", "Marca"]);
      sheet.addRow(["35212514", "Alternador Indiel", "INDIEL"]);
      sheet.addRow(["35213785", "Alternador Indiel 2", "INDIEL"]);
    });

    const workbook = await parseWorkbookFromBuffer(buffer);
    const sheet = workbook.sheets[0];

    expect(sheet?.classification).toBe("IMPORTABLE");
    expect(sheet?.rowCount).toBe(2);
    expect(sheet?.headers).toHaveLength(3);
  });
});
