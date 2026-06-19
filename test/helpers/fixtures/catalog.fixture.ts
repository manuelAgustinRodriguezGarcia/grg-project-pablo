import type { Catalog } from "@/generated/prisma/client";
import type { CatalogWithFolderCount } from "@/server/repositories/catalog.repository";

const baseDate = new Date("2026-06-19T12:00:00.000Z");

export const CATALOG_ID = "clh3pb1a3000012345678901ab";

export function createCatalogFixture(overrides: Partial<Catalog> = {}): Catalog {
  return {
    id: CATALOG_ID,
    name: "Rulemanes",
    description: "Catálogo de rulemanes",
    status: "ACTIVE",
    order: 0,
    visibleToNormalUser: true,
    coverImagePath: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

export function createCatalogWithFolderCountFixture(
  overrides: Partial<CatalogWithFolderCount> = {},
): CatalogWithFolderCount {
  return {
    ...createCatalogFixture(overrides),
    folderCount: overrides.folderCount ?? 0,
  };
}
