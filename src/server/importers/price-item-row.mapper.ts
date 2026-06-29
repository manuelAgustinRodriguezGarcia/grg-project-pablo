import type { PriceColumn } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { generateImportPrimaryCode } from "./generated-primary-code";
import { normalizeCodeForMatch } from "./match-detector";
import type {
  ImportJobConfig,
  MappedProductRow,
  ParsedSheet,
  ParsedSheetRow,
} from "./types";

export type MappedPriceItemRow = MappedProductRow & {
  amount?: string | null;
};

function parseAmount(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).replace(/[^\d.,-]/g, "").replace(",", ".");
  if (!normalized || Number.isNaN(Number(normalized))) {
    return null;
  }

  return new Prisma.Decimal(normalized);
}

function resolveColumnKeyMap(
  sheet: ParsedSheet,
  columns: PriceColumn[],
  config: ImportJobConfig,
): Map<string, string> {
  const headerToColumn = mapHeadersToPriceColumns(sheet.headers, columns);
  const keyMap = new Map<string, string>();

  for (const header of sheet.headers) {
    const mapped = config.columnMapping?.find(
      (entry) => entry.headerInternalKey === header.internalKey,
    );

    if (mapped) {
      keyMap.set(header.internalKey, mapped.folderColumnInternalKey);
      continue;
    }

    const priceColumn = headerToColumn.get(header.internalKey);
    keyMap.set(header.internalKey, priceColumn?.internalKey ?? header.internalKey);
  }

  return keyMap;
}

export function mapHeadersToPriceColumns(
  headers: ParsedSheet["headers"],
  existingColumns: PriceColumn[],
): Map<string, PriceColumn> {
  const byOriginalName = new Map(
    existingColumns.map((column) => [column.originalName.toLowerCase(), column]),
  );
  const result = new Map<string, PriceColumn>();

  for (const header of headers) {
    const match = byOriginalName.get(header.originalName.toLowerCase());
    if (match) {
      result.set(header.internalKey, match);
    }
  }

  return result;
}

function findPrimaryCodeColumnKey(
  sheet: ParsedSheet,
  columns: PriceColumn[],
  config: ImportJobConfig,
): string | undefined {
  if (config.useGeneratedPrimaryCodes) {
    return undefined;
  }

  if (config.primaryCodeColumnKey) {
    return config.primaryCodeColumnKey;
  }

  const primaryColumn = columns.find((column) => column.isPrimaryCode);
  return primaryColumn?.internalKey ?? sheet.headers[0]?.internalKey;
}

function findDescriptionColumnKey(
  columns: PriceColumn[],
  config: ImportJobConfig,
): string | undefined {
  if (config.descriptionColumnKey) {
    return config.descriptionColumnKey;
  }

  const descriptionColumn = columns.find((column) => column.isDescription);
  return descriptionColumn?.internalKey;
}

function findPriceColumnKey(columns: PriceColumn[]): string | undefined {
  const priceColumn = columns.find((column) => column.isPrice);
  return priceColumn?.internalKey;
}

function mapRowToPriceItem(
  row: ParsedSheetRow,
  keyMap: Map<string, string>,
  primaryKey: string | undefined,
  descriptionKey: string | undefined,
  priceKey: string | undefined,
): MappedPriceItemRow {
  const dynamicData: Record<string, unknown> = {};
  const textParts: string[] = [];
  let primaryCode: string | null = null;
  let description: string | null = null;
  let amount: Prisma.Decimal | null = null;

  for (const [headerKey, value] of Object.entries(row.cells)) {
    const columnKey = keyMap.get(headerKey) ?? headerKey;
    const stringValue = value === null || value === undefined ? "" : String(value).trim();

    if (columnKey === primaryKey) {
      primaryCode = stringValue || null;
    } else if (columnKey === descriptionKey) {
      description = stringValue || null;
    } else if (columnKey === priceKey) {
      amount = parseAmount(value);
    } else if (stringValue) {
      dynamicData[columnKey] = value;
      textParts.push(stringValue);
    }
  }

  return {
    rowNumber: row.rowNumber,
    primaryCode,
    normalizedCode: primaryCode ? normalizeCodeForMatch(primaryCode) : null,
    description,
    dynamicData,
    originalText: textParts.length > 0 ? textParts.join(" | ") : row.originalText,
    formulas: row.formulas,
    warnings: row.warnings,
    amount: amount?.toString() ?? null,
  };
}

export function mapSheetToPriceItems(
  sheet: ParsedSheet,
  columns: PriceColumn[],
  config: ImportJobConfig,
): MappedPriceItemRow[] {
  const keyMap = resolveColumnKeyMap(sheet, columns, config);
  const primaryKey = findPrimaryCodeColumnKey(sheet, columns, config);
  const descriptionKey = findDescriptionColumnKey(columns, config);
  const priceKey = findPriceColumnKey(columns);
  const usedGeneratedCodes = new Set<string>();

  return sheet.rows.map((row) => {
    const mapped = mapRowToPriceItem(row, keyMap, primaryKey, descriptionKey, priceKey);

    if (!config.useGeneratedPrimaryCodes || mapped.primaryCode) {
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
