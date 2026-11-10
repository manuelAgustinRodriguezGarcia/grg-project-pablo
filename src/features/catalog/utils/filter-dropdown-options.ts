export function filterOptionsByLabel<T extends { label: string }>(
  options: readonly T[],
  query: string,
): T[] {
  const term = query.trim().toLocaleLowerCase("es");
  if (!term) {
    return [...options];
  }

  return options.filter((option) => option.label.toLocaleLowerCase("es").includes(term));
}