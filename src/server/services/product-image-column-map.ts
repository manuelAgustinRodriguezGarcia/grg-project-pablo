export type ColumnLabelRef = {
  internalKey: string;
  originalName: string;
  displayName: string;
};

export function normalizeColumnLabelForMatch(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function buildColumnKeyLookup(
  columns: ColumnLabelRef[],
): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const column of columns) {
    lookup.set(normalizeColumnLabelForMatch(column.originalName), column.internalKey);
    lookup.set(normalizeColumnLabelForMatch(column.displayName), column.internalKey);
    lookup.set(column.internalKey.toLowerCase(), column.internalKey);
  }

  return lookup;
}

export function resolveImageColumnInternalKey(
  image: {
    label: string | null;
    sourceColumn: string | null;
  },
  columns: ColumnLabelRef[],
): string | null {
  const lookup = buildColumnKeyLookup(columns);
  const columnKeys = new Set(columns.map((column) => column.internalKey));

  if (image.label && columnKeys.has(image.label)) {
    return image.label;
  }

  const candidates = [image.sourceColumn, image.label].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidate of candidates) {
    const key = lookup.get(normalizeColumnLabelForMatch(candidate));
    if (key) {
      return key;
    }
  }

  return null;
}
