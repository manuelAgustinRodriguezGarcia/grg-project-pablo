import type { FolderWithProductCount } from "@/server/repositories/folder.repository";
import type { FolderColumnKeysConfig } from "@/server/services/folder.service";

export type FolderActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type FolderListItem = {
  id: string;
  catalogId: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  order: number;
  visibleToNormalUser: boolean;
  searchConfig: FolderColumnKeysConfig | null;
  filterConfig: FolderColumnKeysConfig | null;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ClearFolderResult = {
  deletedProductCount: number;
};

function parseColumnKeysConfig(
  value: unknown,
): FolderColumnKeysConfig | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "columnInternalKeys" in value &&
    Array.isArray(value.columnInternalKeys)
  ) {
    return {
      columnInternalKeys: value.columnInternalKeys.filter(
        (key): key is string => typeof key === "string",
      ),
    };
  }

  return null;
}

export function toFolderListItem(folder: FolderWithProductCount): FolderListItem {
  return {
    id: folder.id,
    catalogId: folder.catalogId,
    name: folder.name,
    description: folder.description,
    status: folder.status,
    order: folder.order,
    visibleToNormalUser: folder.visibleToNormalUser,
    searchConfig: parseColumnKeysConfig(folder.searchConfig),
    filterConfig: parseColumnKeysConfig(folder.filterConfig),
    productCount: folder.productCount,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}
