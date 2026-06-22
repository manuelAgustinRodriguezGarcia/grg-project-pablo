import type { ColumnDataType } from "@/generated/prisma/client";
import type { SheetClassification } from "@/features/imports/types/sheet.types";

export type DetectedHeader = {
  originalName: string;
  internalKey: string;
  columnIndex: number;
  inferredDataType: ColumnDataType;
};

export type ParsedSheetRow = {
  rowNumber: number;
  cells: Record<string, unknown>;
  originalText: string;
  formulas: ParsedFormula[];
  warnings: string[];
};

export type ParsedFormula = {
  columnKey: string;
  formula: string;
  value: unknown;
  hasCachedValue: boolean;
};

export type ParsedSheet = {
  sheetName: string;
  classification: SheetClassification;
  classificationReason: string;
  headerRow: number;
  headers: DetectedHeader[];
  rows: ParsedSheetRow[];
  rowCount: number;
  columnCount: number;
  imageCount: number;
  imagesByRow: Record<number, number>;
};

export type ParsedWorkbook = {
  sheetNames: string[];
  sheets: ParsedSheet[];
};

export type MappedProductRow = {
  rowNumber: number;
  primaryCode: string | null;
  normalizedCode: string | null;
  description: string | null;
  dynamicData: Record<string, unknown>;
  originalText: string;
  formulas: ParsedFormula[];
  warnings: string[];
  isMatch?: boolean;
  matchedProductId?: string;
};

export type ColumnMappingEntry = {
  headerInternalKey: string;
  folderColumnInternalKey: string;
};

export type ImportJobConfig = {
  columnMapping?: ColumnMappingEntry[];
  primaryCodeColumnKey?: string;
  descriptionColumnKey?: string;
};
