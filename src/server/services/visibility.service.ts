import type {
  Catalog,
  CatalogFolder,
  FolderColumn,
  PriceColumn,
  PriceList,
  UserRole,
} from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { VisibilityError } from "./visibility.errors";

type VisibleEntity = {
  visibleToNormalUser: boolean;
};

type VisibleFolderEntity = VisibleEntity & {
  status?: CatalogFolder["status"];
};

type VisiblePriceListEntity = VisibleEntity & {
  status?: PriceList["status"];
};

export class VisibilityService {
  shouldFilterForRole(role: UserRole): boolean {
    return role !== "ADMIN";
  }

  catalogWhereForRole(role: UserRole): Prisma.CatalogWhereInput {
    if (!this.shouldFilterForRole(role)) {
      return {};
    }

    return { visibleToNormalUser: true };
  }

  folderWhereForRole(role: UserRole): Prisma.CatalogFolderWhereInput {
    if (!this.shouldFilterForRole(role)) {
      return {};
    }

    return {
      visibleToNormalUser: true,
      status: "ACTIVE",
    };
  }

  columnWhereForRole(role: UserRole): Prisma.FolderColumnWhereInput {
    if (!this.shouldFilterForRole(role)) {
      return {};
    }

    return { visibleToNormalUser: true };
  }

  priceListWhereForRole(role: UserRole): Prisma.PriceListWhereInput {
    if (!this.shouldFilterForRole(role)) {
      return {};
    }

    return {
      visibleToNormalUser: true,
      status: "ACTIVE",
    };
  }

  priceColumnWhereForRole(role: UserRole): Prisma.PriceColumnWhereInput {
    if (!this.shouldFilterForRole(role)) {
      return {};
    }

    return { visibleToNormalUser: true };
  }

  filterCatalogs<T extends VisibleEntity>(catalogs: T[], role: UserRole): T[] {
    if (!this.shouldFilterForRole(role)) {
      return catalogs;
    }

    return catalogs.filter((catalog) => catalog.visibleToNormalUser);
  }

  filterFolders<T extends VisibleFolderEntity>(
    folders: T[],
    role: UserRole,
  ): T[] {
    if (!this.shouldFilterForRole(role)) {
      return folders;
    }

    return folders.filter(
      (folder) =>
        folder.visibleToNormalUser &&
        (folder.status === undefined || folder.status === "ACTIVE"),
    );
  }

  filterColumns<T extends VisibleEntity>(columns: T[], role: UserRole): T[] {
    if (!this.shouldFilterForRole(role)) {
      return columns;
    }

    return columns.filter((column) => column.visibleToNormalUser);
  }

  filterPriceLists<T extends VisiblePriceListEntity>(
    lists: T[],
    role: UserRole,
  ): T[] {
    if (!this.shouldFilterForRole(role)) {
      return lists;
    }

    return lists.filter(
      (list) =>
        list.visibleToNormalUser &&
        (list.status === undefined || list.status === "ACTIVE"),
    );
  }

  filterPriceColumns<T extends VisibleEntity>(columns: T[], role: UserRole): T[] {
    if (!this.shouldFilterForRole(role)) {
      return columns;
    }

    return columns.filter((column) => column.visibleToNormalUser);
  }

  assertCatalogVisibleForRole(catalog: Catalog, role: UserRole): void {
    if (this.shouldFilterForRole(role) && !catalog.visibleToNormalUser) {
      throw new VisibilityError("Catálogo no encontrado.", "CATALOG_NOT_VISIBLE");
    }
  }

  assertFolderVisibleForRole(folder: CatalogFolder, role: UserRole): void {
    if (this.shouldFilterForRole(role)) {
      if (!folder.visibleToNormalUser || folder.status !== "ACTIVE") {
        throw new VisibilityError("Carpeta no encontrada.", "FOLDER_NOT_VISIBLE");
      }
    }
  }

  assertColumnVisibleForRole(column: FolderColumn, role: UserRole): void {
    if (this.shouldFilterForRole(role) && !column.visibleToNormalUser) {
      throw new VisibilityError("Columna no encontrada.", "COLUMN_NOT_VISIBLE");
    }
  }

  assertPriceListVisibleForRole(priceList: PriceList, role: UserRole): void {
    if (this.shouldFilterForRole(role)) {
      if (!priceList.visibleToNormalUser || priceList.status !== "ACTIVE") {
        throw new VisibilityError(
          "Lista de precios no encontrada.",
          "PRICE_LIST_NOT_VISIBLE",
        );
      }
    }
  }

  assertPriceColumnVisibleForRole(column: PriceColumn, role: UserRole): void {
    if (this.shouldFilterForRole(role) && !column.visibleToNormalUser) {
      throw new VisibilityError(
        "Columna no encontrada.",
        "PRICE_COLUMN_NOT_VISIBLE",
      );
    }
  }

  stripHiddenDynamicData(
    dynamicData: Record<string, unknown>,
    visibleColumnKeys: Iterable<string>,
    role: UserRole,
  ): Record<string, unknown> {
    if (!this.shouldFilterForRole(role)) {
      return dynamicData;
    }

    const allowedKeys = new Set(visibleColumnKeys);
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(dynamicData)) {
      if (allowedKeys.has(key)) {
        result[key] = value;
      }
    }

    return result;
  }
}

export const visibilityService = new VisibilityService();
