import {
  getProductTableColumns,
  isImageCodeColumn,
} from "@/features/catalog/utils/product-table-columns";
import { formatColumnTitleForDisplay } from "@/features/catalog/utils/column-title-display";
import { normalizeMultilineText } from "@/shared/text/normalize-multiline-text";

export const SEARCH_PREVIEW_COLUMN_LIMIT = 5;

export type SearchPreviewColumnSource = {
  internalKey: string;
  displayName: string;
  originalName: string;
  order: number;
  isPrimaryCode: boolean;
  isDescription: boolean;
  isImageCode: boolean;
};

export type SearchPreviewCell = {
  displayName: string;
  value: string;
};

export function getSearchPreviewColumns<T extends SearchPreviewColumnSource>(
  columns: T[],
): T[] {
  return getProductTableColumns(
    [...columns].sort((left, right) => left.order - right.order),
  )
    .filter((column) => !isImageCodeColumn(column))
    .slice(0, SEARCH_PREVIEW_COLUMN_LIMIT);
}

export function formatSearchPreviewCellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  const text = normalizeMultilineText(String(value)).trim();
  return text.length > 0 ? text : "—";
}

export function buildSearchPreviewCells(
  product: {
    primaryCode: string | null;
    description: string | null;
    dynamicData: Record<string, unknown>;
  },
  columns: SearchPreviewColumnSource[],
): SearchPreviewCell[] {
  return getSearchPreviewColumns(columns).map((column) => {
    let value: unknown;

    if (column.isPrimaryCode) {
      value = product.primaryCode;
    } else if (column.isDescription) {
      value = product.description;
    } else {
      value = product.dynamicData[column.internalKey];
    }

    return {
      displayName: formatColumnTitleForDisplay(column.displayName),
      value: formatSearchPreviewCellValue(value),
    };
  });
}
