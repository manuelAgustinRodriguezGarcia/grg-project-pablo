import type { ImportSheetItem } from "@/features/imports/types/import-job.types";

export type ImportDetectedHeader = {
  originalName: string;
  internalKey: string;
  columnIndex: number;
  inferredDataType?: string;
};

const CODE_HEADER_PATTERNS = [/c[oó]digo/i, /^cod\./i, /referencia/i, /^ref\.?$/i];
const DESCRIPTION_HEADER_PATTERNS = [/descripci[oó]n/i, /^desc\.?$/i, /detalle/i];
const IMAGE_HEADER_PATTERNS = [/imagen/i, /image/i, /foto/i, /photo/i];

export type ColumnSemanticKind = "primaryCode" | "description" | "imageCode" | null;

export function detectColumnSemanticKind(headerName: string): ColumnSemanticKind {
  if (IMAGE_HEADER_PATTERNS.some((pattern) => pattern.test(headerName))) {
    return "imageCode";
  }

  if (CODE_HEADER_PATTERNS.some((pattern) => pattern.test(headerName))) {
    return "primaryCode";
  }

  if (DESCRIPTION_HEADER_PATTERNS.some((pattern) => pattern.test(headerName))) {
    return "description";
  }

  return null;
}

export function semanticKindLabel(kind: ColumnSemanticKind): string | null {
  switch (kind) {
    case "primaryCode":
      return "Código";
    case "description":
      return "Descripción";
    case "imageCode":
      return "Código imagen";
    default:
      return null;
  }
}

export function parseDetectedHeaders(sheet: ImportSheetItem | undefined): ImportDetectedHeader[] {
  if (!sheet || !Array.isArray(sheet.detectedHeaders)) {
    return [];
  }

  return sheet.detectedHeaders.filter((header): header is ImportDetectedHeader => {
    return (
      typeof header === "object" &&
      header !== null &&
      "originalName" in header &&
      "internalKey" in header &&
      "columnIndex" in header
    );
  });
}

export const IGNORE_COLUMN_VALUE = "__ignore__";
export const CREATE_COLUMN_VALUE = "__create__";

export type ColumnMappingRow = {
  headerInternalKey: string;
  headerOriginalName: string;
  targetValue: string;
};

export function buildDefaultColumnMappingRows(
  headers: ImportDetectedHeader[],
  folderColumns: Array<{ id: string; originalName: string; internalKey: string }>,
): ColumnMappingRow[] {
  const folderByName = new Map(
    folderColumns.map((column) => [column.originalName.trim().toLowerCase(), column.internalKey]),
  );

  return headers.map((header) => {
    const matched = folderByName.get(header.originalName.trim().toLowerCase());
    return {
      headerInternalKey: header.internalKey,
      headerOriginalName: header.originalName,
      targetValue: matched ?? CREATE_COLUMN_VALUE,
    };
  });
}

export function resolveFolderColumnKey(
  headerInternalKey: string,
  rows: ColumnMappingRow[],
): string | null {
  const row = rows.find((entry) => entry.headerInternalKey === headerInternalKey);
  if (!row || row.targetValue === IGNORE_COLUMN_VALUE) {
    return null;
  }

  if (row.targetValue === CREATE_COLUMN_VALUE) {
    return headerInternalKey;
  }

  return row.targetValue;
}

export function buildImportColumnMapping(rows: ColumnMappingRow[]) {
  return rows
    .filter((row) => row.targetValue !== IGNORE_COLUMN_VALUE)
    .map((row) => ({
      headerInternalKey: row.headerInternalKey,
      folderColumnInternalKey:
        row.targetValue === CREATE_COLUMN_VALUE
          ? row.headerInternalKey
          : row.targetValue,
    }));
}

export function guessPrimaryCodeHeaderKey(headers: ImportDetectedHeader[]): string {
  const semanticMatch = headers.find(
    (header) => detectColumnSemanticKind(header.originalName) === "primaryCode",
  );
  return semanticMatch?.internalKey ?? headers[0]?.internalKey ?? "";
}

export function guessDescriptionHeaderKey(headers: ImportDetectedHeader[]): string {
  const semanticMatch = headers.find(
    (header) => detectColumnSemanticKind(header.originalName) === "description",
  );
  return semanticMatch?.internalKey ?? "";
}
