import ExcelJS from "exceljs";

export async function createMinimalWorkbookBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const importable = workbook.addWorksheet("Rodamientos");
  importable.addRow(["Código", "Descripción", "Marca"]);
  importable.addRow(["6205", "Ruleman 6205", "SKF"]);
  const formulaRow = importable.addRow(["6206", "Ruleman 6206", "FAG"]);
  importable.getCell(`C${formulaRow.number}`).value = { formula: "12*25.4", result: 304.8 };

  const indexSheet = workbook.addWorksheet("Índice");
  indexSheet.addRow(["Catálogo", "Sección"]);
  indexSheet.addRow(["Rulemanes", "Rodamientos"]);

  const ignored = workbook.addWorksheet("Sheet1");
  ignored.addRow(["temp"]);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
