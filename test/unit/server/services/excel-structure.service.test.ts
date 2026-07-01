import { describe, expect, it } from "vitest";
import { excelStructureService } from "@/server/services/excel-structure.service";

describe("ExcelStructureService", () => {
  it("clasifica hojas índice", () => {
    const result = excelStructureService.classifySheet({ sheetName: "Índice" });

    expect(result.classification).toBe("INDEX");
    expect(result.reason).toContain("índice");
  });

  it("clasifica hojas ignoradas por nombre genérico sin datos tabulares", () => {
    const result = excelStructureService.classifySheet({ sheetName: "Sheet1" });

    expect(result.classification).toBe("IGNORED");
  });

  it("clasifica hojas genéricas como importables cuando tienen tabla válida", () => {
    const sheet1 = excelStructureService.classifySheet({
      sheetName: "Sheet1",
      rowCount: 58,
      hasTabularHeaders: true,
    });
    const hoja1 = excelStructureService.classifySheet({
      sheetName: "Hoja1",
      rowCount: 58,
      hasTabularHeaders: true,
    });

    expect(sheet1.classification).toBe("IMPORTABLE");
    expect(hoja1.classification).toBe("IMPORTABLE");
  });

  it("clasifica hojas vacías como ignoradas", () => {
    const result = excelStructureService.classifySheet({
      sheetName: "Datos",
      rowCount: 0,
    });

    expect(result.classification).toBe("IGNORED");
  });

  it("clasifica hojas sin encabezados tabulares como auxiliares", () => {
    const result = excelStructureService.classifySheet({
      sheetName: "Notas",
      hasTabularHeaders: false,
    });

    expect(result.classification).toBe("AUXILIARY");
  });

  it("clasifica hojas importables por defecto", () => {
    const result = excelStructureService.classifySheet({
      sheetName: "Rodamientos",
      rowCount: 120,
      hasTabularHeaders: true,
    });

    expect(result.classification).toBe("IMPORTABLE");
  });

  it("canCreateFolderFromSheet solo permite IMPORTABLE", () => {
    expect(excelStructureService.canCreateFolderFromSheet("IMPORTABLE")).toBe(true);
    expect(excelStructureService.canCreateFolderFromSheet("INDEX")).toBe(false);
    expect(excelStructureService.canCreateFolderFromSheet("AUXILIARY")).toBe(false);
    expect(excelStructureService.canCreateFolderFromSheet("IGNORED")).toBe(false);
  });
});
