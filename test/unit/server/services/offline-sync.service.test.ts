import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { offlineSyncManifestRepository } from "@/server/repositories/offline-sync-manifest.repository";
import { priceListRepository } from "@/server/repositories/price-list.repository";
import {
  adminUserFixture,
  usuarioUserFixture,
  mockRequireAuth,
} from "../../../helpers/mocks/auth";
import { createCatalogFixture } from "../../../helpers/fixtures/catalog.fixture";
import { createPriceListWithItemCountFixture } from "../../../helpers/fixtures/price-list.fixture";

vi.mock("@/server/database/prisma", () => ({
  prisma: {
    product: { findMany: vi.fn() },
    equivalentCode: { findMany: vi.fn() },
  },
}));
vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/server/repositories/catalog.repository", () => ({
  catalogRepository: {
    findActiveOrdered: vi.fn(),
    findById: vi.fn(),
  },
}));
vi.mock("@/server/repositories/folder.repository", () => ({
  folderRepository: {
    findByCatalogIdOrdered: vi.fn(),
    findById: vi.fn(),
    countByCatalogId: vi.fn(),
  },
}));
vi.mock("@/server/repositories/price-list.repository", () => ({
  priceListRepository: {
    findAllOrdered: vi.fn(),
    findById: vi.fn(),
  },
}));
vi.mock("@/server/repositories/offline-sync-manifest.repository", () => ({
  offlineSyncManifestRepository: {
    getMaxVersionForUser: vi.fn(),
    upsert: vi.fn(),
  },
}));
vi.mock("@/server/repositories/column.repository", () => ({
  columnRepository: {
    findByFolderIdOrdered: vi.fn(),
  },
}));
vi.mock("@/server/repositories/equivalent-code.repository", () => ({
  equivalentCodeRepository: {
    findByProductId: vi.fn(),
    findByProductIds: vi.fn(),
  },
}));
vi.mock("@/server/repositories/product-image.repository", () => ({
  productImageRepository: {
    findAssociatedByProductIds: vi.fn(),
  },
}));
vi.mock("@/server/repositories/price-column.repository", () => ({
  priceColumnRepository: {
    findByPriceListIdOrdered: vi.fn(),
  },
}));
vi.mock("@/server/repositories/price-item.repository", () => ({
  priceItemRepository: {
    findByPriceListIdCursor: vi.fn(),
  },
}));
vi.mock("@/server/services/navigation.service", () => ({
  navigationService: {
    getCatalogNavigation: vi.fn(),
  },
}));
vi.mock("@/server/storage", () => ({
  createSignedDownloadUrl: vi.fn(),
}));

import { offlineSyncService } from "@/server/services/offline-sync.service";

describe("OfflineSyncService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth(usuarioUserFixture);
    vi.mocked(catalogRepository.findActiveOrdered).mockResolvedValue([]);
    vi.mocked(priceListRepository.findAllOrdered).mockResolvedValue([]);
    vi.mocked(offlineSyncManifestRepository.getMaxVersionForUser).mockResolvedValue(0);
    vi.mocked(offlineSyncManifestRepository.upsert).mockResolvedValue({
      id: "manifest-1",
      userId: usuarioUserFixture.id,
      deviceId: "00000000-0000-4000-8000-000000000001",
      version: 1,
      catalogIds: [],
      folderIds: [],
      priceListIds: [],
      syncedAt: new Date(),
      payloadHash: "abc",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("manifest solo incluye catálogos visibles para USUARIO", async () => {
    const visible = createCatalogFixture({ visibleToNormalUser: true });
    const hidden = createCatalogFixture({
      id: "hidden",
      visibleToNormalUser: false,
    });
    vi.mocked(catalogRepository.findActiveOrdered).mockResolvedValue([
      visible,
      hidden,
    ]);
    vi.mocked(folderRepository.findByCatalogIdOrdered).mockResolvedValue([]);

    const manifest = await offlineSyncService.getManifest(
      "00000000-0000-4000-8000-000000000001",
    );

    expect(manifest.catalogs).toHaveLength(1);
    expect(manifest.catalogs[0]?.id).toBe(visible.id);
  });

  it("incrementa manifestVersion al sincronizar", async () => {
    vi.mocked(offlineSyncManifestRepository.getMaxVersionForUser).mockResolvedValue(3);

    const manifest = await offlineSyncService.getManifest(
      "00000000-0000-4000-8000-000000000001",
    );

    expect(manifest.manifestVersion).toBe(4);
    expect(offlineSyncManifestRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ version: 4 }),
    );
  });

  it("incluye listas de precios visibles", async () => {
    mockRequireAuth(adminUserFixture);
    const list = createPriceListWithItemCountFixture();
    vi.mocked(priceListRepository.findAllOrdered).mockResolvedValue([list]);

    const manifest = await offlineSyncService.getManifest(
      "00000000-0000-4000-8000-000000000001",
    );

    expect(manifest.priceLists).toHaveLength(1);
    expect(manifest.priceLists[0]?.name).toBe("Lista general");
  });
});
