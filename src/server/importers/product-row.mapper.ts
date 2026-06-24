import type { FolderColumn } from "@/generated/prisma/client";
import { generateImportPrimaryCode } from "./generated-primary-code";
import { mapHeadersToFolderColumns } from "./column-mapper";
import { normalizeCodeForMatch } from "./match-detector";
import type {
  ColumnMappingEntry,
  ImportJobConfig,
  MappedProductRow,
  ParsedSheet,
  ParsedSheetRow,
} from "./types";

function resolveColumnKeyMap(
  sheet: ParsedSheet,
  columns: FolderColumn[],
  config: ImportJobConfig,
): Map<string, string> {
  const headerToFolder = mapHeadersToFolderColumns(sheet.headers, columns);
  const keyMap = new Map<string, string>();

  for (const header of sheet.headers) {
    const mapped = config.columnMapping?.find(
      (entry) => entry.headerInternalKey === header.internalKey,
    );

    if (mapped) {
      keyMap.set(header.internalKey, mapped.folderColumnInternalKey);
      continue;
    }

    const folderColumn = headerToFolder.get(header.internalKey);
    keyMap.set(header.internalKey, folderColumn?.internalKey ?? header.internalKey);
  }

  return keyMap;
}

function findPrimaryCodeColumnKey(
  sheet: ParsedSheet,
  columns: FolderColumn[],
  config: ImportJobConfig,
): string | undefined {
  if (config.useGeneratedPrimaryCodes) {
    return undefined;
  }

  if (config.primaryCodeColumnKey) {
    return config.primaryCodeColumnKey;
  }

  const primaryColumn = columns.find((column) => column.isPrimaryCode);
  if (primaryColumn) {
    return primaryColumn.internalKey;
  }

  const header = sheet.headers.find((item) =>
    columns.some(
      (column) =>
        column.isPrimaryCode &&
        column.internalKey === item.internalKey,
    ),
  );

  return header?.internalKey ?? sheet.headers[0]?.internalKey;
}

function findDescriptionColumnKey(
  sheet: ParsedSheet,
  columns: FolderColumn[],
  config: ImportJobConfig,
): string | undefined {
  if (config.descriptionColumnKey) {
    return config.descriptionColumnKey;
  }

  const descriptionColumn = columns.find((column) => column.isDescription);
  return descriptionColumn?.internalKey;
}

function mapRowToProduct(
  row: ParsedSheetRow,
  keyMap: Map<string, string>,
  primaryCodeColumnKey: string | undefined,
  descriptionColumnKey: string | undefined,
  columnsByKey: Map<string, FolderColumn>,
): MappedProductRow {
  const dynamicData: Record<string, unknown> = {};
  let primaryCode: string | null = null;
  let description: string | null = null;

  for (const [headerKey, value] of Object.entries(row.cells)) {
    const targetKey = keyMap.get(headerKey) ?? headerKey;
    const column = columnsByKey.get(targetKey);

    if (primaryCodeColumnKey && targetKey === primaryCodeColumnKey && value != null) {
      primaryCode = String(value).trim() || null;
    }

    if (descriptionColumnKey && targetKey === descriptionColumnKey && value != null) {
      description = String(value).trim() || null;
    }

    if (
      primaryCodeColumnKey !== targetKey &&
      descriptionColumnKey !== targetKey
    ) {
      dynamicData[targetKey] = value;
    } else if (!column?.isPrimaryCode && !column?.isDescription) {
      dynamicData[targetKey] = value;
    }
  }

  const normalizedCode = primaryCode ? normalizeCodeForMatch(primaryCode) : null;

  return {
    rowNumber: row.rowNumber,
    primaryCode,
    normalizedCode,
    description,
    dynamicData,
    originalText: row.originalText,
    formulas: row.formulas,
    warnings: row.warnings,
  };
}

export function mapSheetToProducts(
  sheet: ParsedSheet,
  columns: FolderColumn[],
  config: ImportJobConfig = {},
): MappedProductRow[] {
  const keyMap = resolveColumnKeyMap(sheet, columns, config);
  const columnsByKey = new Map(columns.map((column) => [column.internalKey, column]));
  const primaryCodeColumnKey = findPrimaryCodeColumnKey(sheet, columns, config);
  const descriptionColumnKey = findDescriptionColumnKey(sheet, columns, config);
  const usedGeneratedCodes = new Set<string>();

  return sheet.rows.map((row) => {
    const mapped = mapRowToProduct(
      row,
      keyMap,
      primaryCodeColumnKey,
      descriptionColumnKey,
      columnsByKey,
    );

    if (!config.useGeneratedPrimaryCodes) {
      return mapped;
    }

    const primaryCode = generateImportPrimaryCode(usedGeneratedCodes);

    return {
      ...mapped,
      primaryCode,
      normalizedCode: normalizeCodeForMatch(primaryCode),
    };
  });
}

export type { ColumnMappingEntry, ImportJobConfig };
