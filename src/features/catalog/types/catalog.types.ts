import type { CatalogWithFolderCount } from "@/server/repositories/catalog.repository";

export type CatalogActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type CatalogListItem = {
  id: string;
  name: string;
  description: string | null;
  coverImagePath: string | null;
  status: "ACTIVE" | "INACTIVE" | "HIDDEN";
  order: number;
  visibleToNormalUser: boolean;
  folderCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ClearCatalogResult = {
  deletedProductCount: number;
};

export function toCatalogListItem(
  catalog: CatalogWithFolderCount,
): CatalogListItem {
  return {
    id: catalog.id,
    name: catalog.name,
    description: catalog.description,
    coverImagePath: catalog.coverImagePath,
    status: catalog.status,
    order: catalog.order,
    visibleToNormalUser: catalog.visibleToNormalUser,
    folderCount: catalog.folderCount,
    createdAt: catalog.createdAt.toISOString(),
    updatedAt: catalog.updatedAt.toISOString(),
  };
}
