import type { DetectedHeader, ImportJobConfig } from "./types";

type FolderColumnRef = {
  originalName: string;
  internalKey: string;
};

function resolveMappedFolderColumnKey(
  header: DetectedHeader,
  columns: FolderColumnRef[],
  config: ImportJobConfig,
): string | null {
  const mapping = new Map(
    (config.columnMapping ?? []).map((entry) => [
      entry.headerInternalKey,
      entry.folderColumnInternalKey,
    ]),
  );

  const mapped = mapping.get(header.internalKey);
  if (mapped === "__ignore__") {
    return null;
  }

  if (mapped) {
    return mapped;
  }

  const byName = columns.find(
    (column) =>
      column.originalName.trim().toLowerCase() ===
      header.originalName.trim().toLowerCase(),
  );

  return byName?.internalKey ?? header.internalKey;
}

export function findRepeatedColumnNames(
  headers: DetectedHeader[],
  columns: FolderColumnRef[],
  config: ImportJobConfig,
): string[] {
  if (columns.length === 0) {
    return [];
  }

  const existingKeys = new Set(columns.map((column) => column.internalKey));
  const existingNames = new Set(
    columns.map((column) => column.originalName.trim().toLowerCase()),
  );
  const repeated = new Set<string>();

  for (const header of headers) {
    const targetKey = resolveMappedFolderColumnKey(header, columns, config);
    if (!targetKey) {
      continue;
    }

    const normalizedName = header.originalName.trim().toLowerCase();
    if (existingKeys.has(targetKey) || existingNames.has(normalizedName)) {
      repeated.add(header.originalName);
    }
  }

  return [...repeated].sort((left, right) => left.localeCompare(right, "es"));
}
