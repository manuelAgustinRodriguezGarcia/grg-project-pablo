export function sortByName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, "es"),
  );
}
