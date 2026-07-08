export function getPriceFilterableColumnKeys(
  columns: Array<{ internalKey: string }>,
): string[] {
  return columns.map((column) => column.internalKey);
}
