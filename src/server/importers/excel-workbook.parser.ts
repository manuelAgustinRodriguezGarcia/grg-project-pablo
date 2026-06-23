import ExcelJS from "exceljs";
import { parseWorksheet } from "./excel-sheet.parser";
import type { ParsedWorkbook } from "./types";

type ExcelJsLoadInput = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

/** ExcelJS types use a global `Buffer` extending ArrayBuffer, not Node's Buffer. */
export function toExcelJsBuffer(buffer: Buffer | Uint8Array): ExcelJsLoadInput {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Buffer.from(bytes) as unknown as ExcelJsLoadInput;
}

export async function parseWorkbookFromBuffer(
  buffer: Buffer | Uint8Array,
): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toExcelJsBuffer(buffer));

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
