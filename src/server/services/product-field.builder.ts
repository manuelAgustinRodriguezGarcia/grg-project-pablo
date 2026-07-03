import type { FolderColumn } from "@/generated/prisma/client";
import type { MappedProductRow } from "@/server/importers/types";
import { normalizeCodeForMatch } from "@/server/importers/match-detector";
import { ProductError } from "./product.errors";
import {
  collectEquivalenceTokensFromColumns,
  type ParsedEquivalenceToken,
} from "./equivalence.parser";

export type BuildIndexedTextInput = {
  primaryCode: string | null;
  description: string | null;
  columns: FolderColumn[];
  dynamicData: Record<string, unknown>;
  equivalenceTokens: ParsedEquivalenceToken[];
};

export type ProductFieldInput = {
  values: Record<string, unknown>;
};

export type BuiltProductFields = {
  primaryCode: string | null;
  normalizedCode: string | null;
  description: string | null;
  dynamicData: Record<string, unknown>;
  originalText: string | null;
  indexedText: string | null;
  equivalenceTokens: ParsedEquivalenceToken[];
};

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  return String(value).trim().length === 0;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function findPrimaryCodeColumn(columns: FolderColumn[]): FolderColumn | undefined {
  return columns.find((column) => column.isPrimaryCode);
}

function findDescriptionColumn(columns: FolderColumn[]): FolderColumn | undefined {
  return columns.find((column) => column.isDescription);
}

function assertColumnEditable(column: FolderColumn, key: string): void {
  if (column.isReadOnly || !column.isAdminEditable) {
    throw new ProductError(
      `La columna "${column.displayName}" no es editable.`,
      "COLUMN_NOT_EDITABLE",
    );
  }

  if (!column.internalKey && key) {
    throw new ProductError("Columna no editable.", "COLUMN_NOT_EDITABLE");
  }
}

function buildOriginalText(parts: string[]): string | null {
  const filtered = parts.map((part) => part.trim()).filter((part) => part.length > 0);
  return filtered.length > 0 ? filtered.join(" | ") : null;
}

export function buildIndexedText(input: BuildIndexedTextInput): string | null {
  const parts: string[] = [];

  if (input.primaryCode) {
    parts.push(input.primaryCode);
  }

  if (input.description) {
    parts.push(input.description);
  }

  for (const column of input.columns) {
    const value = input.dynamicData[column.internalKey];
    if (!isEmptyValue(value)) {
      parts.push(stringifyValue(value));
    }
  }

  for (const token of input.equivalenceTokens) {
    parts.push(token.originalCode);
    parts.push(token.normalizedCode);
  }

  const unique = [...new Set(parts.map((part) => part.trim()).filter(Boolean))];
  return unique.length > 0 ? unique.join(" ") : null;
}

export function buildIndexedTextForMappedProduct(
  columns: FolderColumn[],
  product: Pick<
    MappedProductRow,
    "primaryCode" | "description" | "dynamicData"
  >,
): string | null {
  const equivalenceTokens = collectEquivalenceTokensFromColumns(
    columns,
    product.dynamicData,
  );

  return buildIndexedText({
    primaryCode: product.primaryCode,
    description: product.description,
    columns,
    dynamicData: product.dynamicData,
    equivalenceTokens,
  });
}

export function buildIndexedTextForStoredProduct(
  columns: FolderColumn[],
  product: {
    primaryCode: string | null;
    description: string | null;
    dynamicData: unknown;
  },
): string | null {
  const dynamicData =
    typeof product.dynamicData === "object" &&
    product.dynamicData !== null &&
    !Array.isArray(product.dynamicData)
      ? (product.dynamicData as Record<string, unknown>)
      : {};

  return buildIndexedTextForMappedProduct(columns, {
    primaryCode: product.primaryCode,
    description: product.description,
    dynamicData,
  });
}

export function buildProductFields(
  columns: FolderColumn[],
  input: ProductFieldInput,
): BuiltProductFields {
  const columnsByKey = new Map(columns.map((column) => [column.internalKey, column]));
  const primaryColumn = findPrimaryCodeColumn(columns);
  const descriptionColumn = findDescriptionColumn(columns);

  let primaryCode: string | null = null;
  let description: string | null = null;
  const dynamicData: Record<string, unknown> = {};
  const originalParts: string[] = [];

  for (const [key, rawValue] of Object.entries(input.values)) {
    const column = columnsByKey.get(key);
    if (!column) {
      throw new ProductError(`Columna desconocida: ${key}.`, "VALIDATION_ERROR");
    }

    if (column.isReadOnly || !column.isAdminEditable) {
      throw new ProductError(
        `La columna "${column.displayName}" no es editable.`,
        "COLUMN_NOT_EDITABLE",
      );
    }

    assertColumnEditable(column, key);

    if (column.isRequired && isEmptyValue(rawValue)) {
      throw new ProductError(
        `La columna "${column.displayName}" es obligatoria.`,
        "VALIDATION_ERROR",
      );
    }

    const value = isEmptyValue(rawValue) ? null : rawValue;

    if (primaryColumn && key === primaryColumn.internalKey) {
      primaryCode = value === null ? null : stringifyValue(value);
      if (primaryCode) {
        originalParts.push(primaryCode);
      }
      continue;
    }

    if (descriptionColumn && key === descriptionColumn.internalKey) {
      description = value === null ? null : stringifyValue(value);
      if (description) {
        originalParts.push(description);
      }
      continue;
    }

    dynamicData[key] = value ?? null;
    if (value !== null && value !== undefined) {
      originalParts.push(`${column.displayName}: ${stringifyValue(value)}`);
    }
  }

  for (const column of columns) {
    if (!column.isRequired) {
      continue;
    }

    if (column.isPrimaryCode) {
      if (!primaryCode) {
        throw new ProductError(
          `La columna "${column.displayName}" es obligatoria.`,
          "VALIDATION_ERROR",
        );
      }
      continue;
    }

    if (column.isDescription) {
      if (!description) {
        throw new ProductError(
          `La columna "${column.displayName}" es obligatoria.`,
          "VALIDATION_ERROR",
        );
      }
      continue;
    }

    if (isEmptyValue(dynamicData[column.internalKey])) {
      throw new ProductError(
        `La columna "${column.displayName}" es obligatoria.`,
        "VALIDATION_ERROR",
      );
    }
  }

  const equivalenceTokens = collectEquivalenceTokensFromColumns(columns, dynamicData);
  const normalizedCode = primaryCode ? normalizeCodeForMatch(primaryCode) : null;
  const originalText = buildOriginalText(originalParts);
  const indexedText = buildIndexedText({
    primaryCode,
    description,
    columns,
    dynamicData,
    equivalenceTokens,
  });

  return {
    primaryCode,
    normalizedCode,
    description,
    dynamicData,
    originalText,
    indexedText,
    equivalenceTokens,
  };
}

export function productToFieldValues(
  product: {
    primaryCode: string | null;
    description: string | null;
    dynamicData: unknown;
  },
  columns: FolderColumn[],
): Record<string, unknown> {
  const dynamicData =
    typeof product.dynamicData === "object" &&
    product.dynamicData !== null &&
    !Array.isArray(product.dynamicData)
      ? (product.dynamicData as Record<string, unknown>)
      : {};

  const values: Record<string, unknown> = {};

  for (const column of columns) {
    if (column.isPrimaryCode) {
      values[column.internalKey] = product.primaryCode;
    } else if (column.isDescription) {
      values[column.internalKey] = product.description;
    } else {
      values[column.internalKey] = dynamicData[column.internalKey] ?? null;
    }
  }

  return values;
}

export function buildProductFieldsForDuplicate(
  product: {
    primaryCode: string | null;
    normalizedCode: string | null;
    description: string | null;
    dynamicData: unknown;
    originalText: string | null;
    indexedText: string | null;
  },
  columns: FolderColumn[],
): BuiltProductFields {
  const dynamicData =
    typeof product.dynamicData === "object" &&
    product.dynamicData !== null &&
    !Array.isArray(product.dynamicData)
      ? (product.dynamicData as Record<string, unknown>)
      : {};

  const equivalenceTokens = collectEquivalenceTokensFromColumns(columns, dynamicData);

  return {
    primaryCode: product.primaryCode,
    normalizedCode: product.normalizedCode,
    description: product.description,
    dynamicData: { ...dynamicData },
    originalText: product.originalText,
    indexedText: product.indexedText,
    equivalenceTokens,
  };
}