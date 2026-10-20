export function getPriceFilterableColumnKeys(
  columns: Array<{ internalKey: string }>,
): string[] {
  return columns.map((column) => column.internalKey);
}

export function sortPriceColumnsByConfiguredOrder<
  T extends { id: string; displayName: string },
>(columns: readonly T[], orderById: ReadonlyMap<string, number>): T[] {
  return [...columns].sort((left, right) => {
    const leftOrder = orderById.get(left.id) ?? 0;
    const rightOrder = orderById.get(right.id) ?? 0;
    return leftOrder - rightOrder || left.displayName.localeCompare(right.displayName, "es");
  });
}
