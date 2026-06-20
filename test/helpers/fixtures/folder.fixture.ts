import type { CatalogFolder } from "@/generated/prisma/client";
import type { FolderWithProductCount } from "@/server/repositories/folder.repository";
import { CATALOG_ID } from "./catalog.fixture";

const baseDate = new Date("2026-06-19T12:00:00.000Z");

export const FOLDER_ID = "clh3pb1a3000012345678902cd";

export function createFolderFixture(
  overrides: Partial<CatalogFolder> = {},
): CatalogFolder {
  return {
    id: FOLDER_ID,
    catalogId: CATALOG_ID,
    name: "Rodamientos",
    description: "Carpeta de rodamientos",
    status: "ACTIVE",
    order: 0,
    visibleToNormalUser: true,
    searchConfig: null,
    filterConfig: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

export function createFolderWithProductCountFixture(
  overrides: Partial<FolderWithProductCount> = {},
): FolderWithProductCount {
  return {
    ...createFolderFixture(overrides),
    productCount: overrides.productCount ?? 0,
  };
}
