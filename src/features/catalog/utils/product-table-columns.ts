import { GENERATED_PRIMARY_CODE_COLUMN_KEY } from "@/shared/import/generated-primary-code.constants";
import { isImageCodeColumnName } from "@/shared/import/header-semantics";

export function isGeneratedPrimaryCodeColumn(column: {
  internalKey: string;
}): boolean {
  return column.internalKey === GENERATED_PRIMARY_CODE_COLUMN_KEY;
}

export function isImageCodeColumn(column: {
  isImageCode: boolean;
  originalName: string;
  displayName: string;
}): boolean {
  if (column.isImageCode) {
    return true;
  }

  return (
    isImageCodeColumnName(column.originalName) ||
    isImageCodeColumnName(column.displayName)
  );
}

export function getProductTableColumns<T extends { internalKey: string }>(
  columns: T[],
): T[] {
  return columns.filter((column) => !isGeneratedPrimaryCodeColumn(column));
}

export function folderHasLinkedImages(
  columns: Array<{
    isImageCode: boolean;
    originalName: string;
    displayName: string;
  }>,
): boolean {
  return columns.some(isImageCodeColumn);
}

export function getAdminFilterableColumnKeys(
  columns: Array<{
    internalKey: string;
    isImageCode: boolean;
    originalName: string;
    displayName: string;
  }>,
): string[] {
  return getProductTableColumns(columns)
    .filter((column) => !isImageCodeColumn(column))
    .map((column) => column.internalKey);
}
