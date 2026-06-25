import type { Row, Worksheet } from "exceljs";
import { excelStructureService } from "@/server/services/excel-structure.service";
import { extractCellValue, toParsedFormula } from "./excel-cell.extractor";
import {
  buildEmbeddedImageSummary,
  buildSheetImageStats,
  listEmbeddedImageAnchors,
} from "./excel-image.detector";
import { buildDetectedHeaders } from "./column-mapper";
import type { ParsedSheet, ParsedSheetRow } from "./types";

function getCellText(row: Row, columnIndex: number): string {
  const cell = row.getCell(columnIndex + 1);
  const extracted = extractCellValue(cell);
  const value = extracted.displayValue;

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function getWorksheetMaxColumn(worksheet: Worksheet, fromRow: number): number {
  let maxColumn = 0;

  for (let rowNumber = fromRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.eachCell({ includeEmpty: true }, (_cell, colNumber) => {
      maxColumn = Math.max(maxColumn, colNumber);
    });
  }

  return maxColumn;
}

function columnHasData(
  worksheet: Worksheet,
  headerRow: number,
  columnIndex: number,
): boolean {
  for (let rowNumber = headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    if (getCellText(worksheet.getRow(rowNumber), columnIndex)) {
      return true;
    }
  }

  return false;
}

function detectImportableColumns(
  worksheet: Worksheet,
  headerRow: number,
): Array<{ originalName: string; columnIndex: number }> {
  const maxColumn = getWorksheetMaxColumn(worksheet, headerRow);
  const headerCells = worksheet.getRow(headerRow);
  const columns: Array<{ originalName: string; columnIndex: number }> = [];

  for (let col = 1; col <= maxColumn; col += 1) {
    const columnIndex = col - 1;
    const headerName = getCellText(headerCells, columnIndex);
    const hasData = columnHasData(worksheet, headerRow, columnIndex);

    if (!headerName && !hasData) {
      continue;
    }

    columns.push({
      columnIndex,
      originalName: headerName || `Columna ${col}`,
    });
  }

  return columns;
}

function isRowEmptyForHeaders(row: Row, headers: ReturnType<typeof buildDetectedHeaders>): boolean {
  for (const header of headers) {
    if (getCellText(row, header.columnIndex)) {
      return false;
    }
  }

  return true;
}

function detectHeaderRow(worksheet: Worksheet): number | null {
  const maxScan = Math.min(worksheet.rowCount, 20);

  for (let rowNumber = 1; rowNumber <= maxScan; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const texts: string[] = [];

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const extracted = extractCellValue(cell);
      const text =
        extracted.displayValue === null || extracted.displayValue === undefined
          ? ""
          : String(extracted.displayValue).trim();

      if (text) {
        texts[colNumber - 1] = text;
      }
    });

    const filled = texts.filter(Boolean);

    if (filled.length >= 2) {
      return rowNumber;
    }
  }

  return null;
}

function parseDataRows(
  worksheet: Worksheet,
  headerRow: number,
  headers: ReturnType<typeof buildDetectedHeaders>,
): ParsedSheetRow[] {
  const rows: ParsedSheetRow[] = [];

  for (let rowNumber = headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);

    if (isRowEmptyForHeaders(row, headers)) {
      continue;
    }

    const cells: Record<string, unknown> = {};
    const formulas: ParsedSheetRow["formulas"] = [];
    const warnings: string[] = [];
    const textParts: string[] = [];

    for (const header of headers) {
      const cell = row.getCell(header.columnIndex + 1);
      const extracted = extractCellValue(cell);
      cells[header.internalKey] = extracted.displayValue;

      if (extracted.displayValue !== null && extracted.displayValue !== undefined) {
        textParts.push(String(extracted.displayValue));
      }

      const parsedFormula = toParsedFormula(header.internalKey, extracted);
      if (parsedFormula) {
        formulas.push(parsedFormula);
        if (!parsedFormula.hasCachedValue) {
          warnings.push(
            `Fila ${rowNumber}, columna "${header.originalName}": fórmula sin valor calculado guardado.`,
          );
        }
      }
    }

    rows.push({
      rowNumber,
      cells,
      originalText: textParts.join(" | "),
      formulas,
      warnings,
    });
  }

  return rows;
}

export function parseWorksheet(worksheet: Worksheet): ParsedSheet {
  const headerRow = detectHeaderRow(worksheet);
  const imageAnchors = listEmbeddedImageAnchors(worksheet);
  const imageStats = buildSheetImageStats(imageAnchors);
  const embeddedImageSummary = buildEmbeddedImageSummary(imageAnchors);

  if (!headerRow) {
    const classification = excelStructureService.classifySheet({
      sheetName: worksheet.name,
      rowCount: worksheet.rowCount,
      hasTabularHeaders: false,
    });

    return {
      sheetName: worksheet.name,
      classification: classification.classification,
      classificationReason: classification.reason,
      headerRow: 0,
      headers: [],
      rows: [],
      rowCount: worksheet.rowCount,
      columnCount: 0,
      imageCount: imageStats.totalCount,
      imagesByRow: imageStats.byRow,
      embeddedImageSummary,
    };
  }

  const importableColumns = detectImportableColumns(worksheet, headerRow);
  const headers = buildDetectedHeaders(importableColumns);
  const rows = parseDataRows(worksheet, headerRow, headers);

  const classification = excelStructureService.classifySheet({
    sheetName: worksheet.name,
    rowCount: rows.length,
    hasTabularHeaders: headers.length >= 2,
  });

  return {
    sheetName: worksheet.name,
    classification: classification.classification,
    classificationReason: classification.reason,
    headerRow,
    headers,
    rows,
    rowCount: rows.length,
    columnCount: headers.length,
    imageCount: imageStats.totalCount,
    imagesByRow: imageStats.byRow,
    embeddedImageSummary,
  };
}
