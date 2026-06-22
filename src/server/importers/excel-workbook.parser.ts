import ExcelJS from "exceljs";
import { parseWorksheet } from "./excel-sheet.parser";
import type { ParsedWorkbook } from "./types";

export async function parseWorkbookFromBuffer(
  buffer: Buffer | Uint8Array,
): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer));

  const sheets = workbook.worksheets.map((worksheet) => parseWorksheet(worksheet));

  return {
    sheetNames: workbook.worksheets.map((sheet) => sheet.name),
    sheets,
  };
}

export async function parseSheetFromBuffer(
  buffer: Buffer,
  sheetName: string,
): Promise<ParsedWorkbook["sheets"][number] | null> {
  const workbook = await parseWorkbookFromBuffer(buffer);
  return workbook.sheets.find((sheet) => sheet.sheetName === sheetName) ?? null;
}
