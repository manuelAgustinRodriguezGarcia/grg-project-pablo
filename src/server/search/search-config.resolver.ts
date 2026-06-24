import type { CatalogFolder, FolderColumn } from "@/generated/prisma/client";
import type { FolderColumnKeysConfig } from "@/server/repositories/folder.repository";

function parseColumnKeysConfig(
  config: unknown,
): FolderColumnKeysConfig | null {
  if (config === null || config === undefined) {
    return null;
  }

  if (
    typeof config === "object" &&
    config !== null &&
    "columnInternalKeys" in config &&
    Array.isArray((config as FolderColumnKeysConfig).columnInternalKeys)
  ) {
    return config as FolderColumnKeysConfig;
  }

  return null;
}

function resolveConfiguredKeys(
  folder: CatalogFolder,
  configKey: "searchConfig" | "filterConfig",
  flag: "isSearchable" | "isFilterable",
  columns: FolderColumn[],
): string[] {
  const configured = parseColumnKeysConfig(folder[configKey]);
  const eligible = columns
    .filter((column) => column[flag])
    .map((column) => column.internalKey);

  if (!configured) {
    return eligible;
  }

  return configured.columnInternalKeys.filter((key) => eligible.includes(key));
}

export function resolveSearchableKeys(
  folder: CatalogFolder,
  columns: FolderColumn[],
): string[] {
  return resolveConfiguredKeys(folder, "searchConfig", "isSearchable", columns);
}

export function resolveFilterableKeys(
  folder: CatalogFolder,
  columns: FolderColumn[],
): string[] {
  return resolveConfiguredKeys(folder, "filterConfig", "isFilterable", columns);
}

export function resolveGloballySearchableKeys(columns: FolderColumn[]): string[] {
  return columns
    .filter((column) => column.isGloballySearchable)
    .map((column) => column.internalKey);
}
