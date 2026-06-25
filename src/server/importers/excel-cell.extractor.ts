import type { Cell } from "exceljs";
import { normalizeMultilineText } from "@/shared/text/normalize-multiline-text";
import type { ParsedFormula } from "./types";

export type ExtractedCellValue = {
  displayValue: unknown;
  formula?: string;
  hasCachedValue: boolean;
};

function isRichText(value: unknown): value is { richText: Array<{ text: string }> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "richText" in value &&
    Array.isArray((value as { richText: unknown }).richText)
  );
}

function shouldPreferCellText(value: unknown): boolean {
  if (typeof value === "string") {
    return true;
  }

  if (isRichText(value)) {
    return true;
  }

  if (typeof value === "object" && value !== null && "text" in value) {
    return true;
  }

  return false;
}

function flattenCellValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (isRichText(value)) {
    return value.richText.map((part) => part.text).join("");
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && "text" in value) {
    return (value as { text: unknown }).text;
  }

  if (typeof value === "object" && "result" in value) {
    return flattenCellValue((value as { result: unknown }).result);
  }

  return value;
}

function resolveDisplayValue(cell: Cell, rawValue: unknown): unknown {
  if (shouldPreferCellText(rawValue) && typeof cell.text === "string") {
    return normalizeMultilineText(cell.text);
  }

  const flattened = flattenCellValue(rawValue);

  if (typeof flattened === "string") {
    return normalizeMultilineText(flattened);
  }

  return flattened;
}

export function extractCellValue(cell: Cell | undefined): ExtractedCellValue {
  if (!cell || cell.value === null || cell.value === undefined) {
    return { displayValue: null, hasCachedValue: true };
  }

  const formula = cell.formula ?? undefined;
  const hasResult = cell.result !== undefined && cell.result !== null;

  if (formula) {
    const rawValue = hasResult ? cell.result : cell.value;
    return {
      displayValue: resolveDisplayValue(cell, rawValue),
      formula,
      hasCachedValue: hasResult,
    };
  }

  return {
    displayValue: resolveDisplayValue(cell, cell.value),
    hasCachedValue: true,
  };
}

export function toParsedFormula(
  columnKey: string,
  extracted: ExtractedCellValue,
): ParsedFormula | null {
  if (!extracted.formula) {
    return null;
  }

  return {
    columnKey,
    formula: extracted.formula,
    value: extracted.displayValue,
    hasCachedValue: extracted.hasCachedValue,
  };
}
