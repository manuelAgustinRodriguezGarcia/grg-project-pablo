import { GENERATED_PRIMARY_CODE_COLUMN_KEY } from "@/shared/import/generated-primary-code.constants";

export function isGeneratedPrimaryCodeColumn(column: {
  internalKey: string;
}): boolean {
  return column.internalKey === GENERATED_PRIMARY_CODE_COLUMN_KEY;
}

export function getProductTableColumns<T extends { internalKey: string }>(
  columns: T[],
): T[] {
  return columns.filter((column) => !isGeneratedPrimaryCodeColumn(column));
}
