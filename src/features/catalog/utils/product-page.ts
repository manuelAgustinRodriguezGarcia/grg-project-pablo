export function pageForProductIndex(
  index: number,
  pageSize: number,
): number | null {
  if (index < 0 || pageSize < 1) {
    return null;
  }

  return Math.floor(index / pageSize) + 1;
}
