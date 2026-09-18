export type CatalogView = "catalog-picker" | "folder-picker" | "products";

export function resolveCatalogView(input: {
  activeCatalogId: string;
  activeFolderId: string;
  preferProductsShell: boolean;
}): CatalogView {
  if (!input.activeCatalogId) {
    return "catalog-picker";
  }

  if (!input.activeFolderId) {
    return input.preferProductsShell ? "products" : "folder-picker";
  }

  return "products";
}

export function resolveActiveFolderId(input: {
  activeCatalogId: string;
  selectedFolderId: string;
  isNavigationReady: boolean;
  folderIds: readonly string[];
}): string {
  if (!input.activeCatalogId) {
    return "";
  }

  if (!input.isNavigationReady) {
    return input.selectedFolderId;
  }

  if (
    input.selectedFolderId &&
    input.folderIds.includes(input.selectedFolderId)
  ) {
    return input.selectedFolderId;
  }

  return "";
}

export function scrollOptionIntoMenu(
  row: HTMLElement,
  menu: HTMLElement,
): void {
  const menuRect = menu.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();

  if (rowRect.bottom > menuRect.bottom) {
    menu.scrollTop += rowRect.bottom - menuRect.bottom;
    return;
  }

  if (rowRect.top < menuRect.top) {
    menu.scrollTop -= menuRect.top - rowRect.top;
  }
}
