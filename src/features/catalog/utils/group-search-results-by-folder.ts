import type { SearchResultItem } from "@/features/catalog/types/global-search.types";

export type ProductFolderSearchGroup = {
  folderId: string;
  folderName: string;
  catalogId: string;
  catalogName: string;
  items: SearchResultItem[];
};

export function groupSearchResultsByFolder(
  items: SearchResultItem[],
): ProductFolderSearchGroup[] {
  const groupsByFolderId = new Map<string, ProductFolderSearchGroup>();

  for (const item of items) {
    const existing = groupsByFolderId.get(item.folder.id);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    groupsByFolderId.set(item.folder.id, {
      folderId: item.folder.id,
      folderName: item.folder.name,
      catalogId: item.catalog.id,
      catalogName: item.catalog.name,
      items: [item],
    });
  }

  return [...groupsByFolderId.values()];
}

export function formatProductFolderResultCount(
  resultCount: number,
  folderName: string,
): string {
  const countLabel =
    resultCount === 1 ? "1 resultado" : `${resultCount} resultados`;

  return `${countLabel} en ${folderName}`;
}

export function formatProductFolderResultLabel(
  resultCount: number,
  folderName: string,
  catalogName: string,
): string {
  return `${formatProductFolderResultCount(resultCount, folderName)} | Catálogo: ${catalogName}`;
}
