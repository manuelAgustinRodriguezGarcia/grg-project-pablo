import { GENERATED_PRIMARY_CODE_COLUMN_KEY } from "@/shared/import/generated-primary-code.constants";
import {
  isBroadImageLabelHeader,
  isImageCodeColumnName,
} from "@/shared/import/header-semantics";

export function isGeneratedPrimaryCodeColumn(column: {
  internalKey: string;
}): boolean {
  return column.internalKey === GENERATED_PRIMARY_CODE_COLUMN_KEY;
}

/**
 * ZIP image-code columns only ("COD. IMG.", "CODIGO IMAGEN", …).
 * Plain "IMAGEN"/"FOTO" headers (embedded pictures) must not activate
 * the linked-image / COL 0 UI — even if an older import set isImageCode.
 */
export function isImageCodeColumn(column: {
  isImageCode: boolean;
  originalName: string;
  displayName: string;
}): boolean {
  if (
    isImageCodeColumnName(column.originalName) ||
    isImageCodeColumnName(column.displayName)
  ) {
    return true;
  }

  if (!column.isImageCode) {
    return false;
  }

  // Ignore stale flags on plain image-label headers from older imports.
  if (
    isBroadImageLabelHeader(column.originalName) ||
    isBroadImageLabelHeader(column.displayName)
  ) {
    return false;
  }

  return true;
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
