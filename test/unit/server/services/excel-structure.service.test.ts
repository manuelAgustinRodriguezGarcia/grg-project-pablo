import { describe, expect, it } from "vitest";
import { excelStructureService } from "@/server/services/excel-structure.service";

describe("ExcelStructureService", () => {
  it("clasifica hojas índice", () => {
    const result = excelStructureService.classifySheet({ sheetName: "Índice" });

    expect(result.classification).toBe("INDEX");
    expect(result.reason).toContain("índice");
  });

  it("clasifica hojas ignoradas por nombre genérico", () => {
    const result = excelStructureService.classifySheet({ sheetName: "Sheet1" });

    expect(result.classification).toBe("IGNORED");
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
