import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/server/auth/errors";
import { requireAuth } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { createSignedDownloadUrl } from "@/server/storage";
import { directoryService } from "@/server/services/directory.service";
import { offlineSyncService } from "@/server/services/offline-sync.service";
import {
  adminUserFixture,
  usuarioUserFixture,
  mockRequireAuth,
  mockRequireAuthUnauthenticated,
} from "../../../helpers/mocks/auth";
import { createCatalogFixture } from "../../../helpers/fixtures/catalog.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/server/repositories/catalog.repository", () => ({
  catalogRepository: {
    findActiveOrdered: vi.fn(),
  },
}));
vi.mock("@/server/repositories/folder.repository", () => ({
  folderRepository: {
    countByCatalogId: vi.fn(),
  },
}));
vi.mock("@/server/services/offline-sync.service", () => ({
  offlineSyncService: {
    getLastServerVersion: vi.fn(),
  },
}));
vi.mock("@/server/storage", () => ({
  createSignedDownloadUrl: vi.fn(),
}));

describe("DirectoryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth(usuarioUserFixture);
    vi.mocked(createSignedDownloadUrl).mockResolvedValue({
      signedUrl: "https://example.com/signed-url",
      bucket: "product-images",
      path: "catalogs/test/cover.jpg",
      expiresInSeconds: 3600,
    });
    vi.mocked(catalogRepository.findActiveOrdered).mockResolvedValue([]);
    vi.mocked(folderRepository.countByCatalogId).mockResolvedValue(0);
    vi.mocked(offlineSyncService.getLastServerVersion).mockResolvedValue(0);
  });

  it("exige autenticación", async () => {
    mockRequireAuthUnauthenticated();

    await expect(directoryService.getDirectory()).rejects.toBeInstanceOf(AuthError);
    expect(requireAuth).toHaveBeenCalled();
  });

  it("devuelve catálogos activos con metadatos de directorio", async () => {
    const catalog = createCatalogFixture({
      name: "Embragues",
      coverImagePath: "catalogs/embragues/cover.jpg",
    });
    vi.mocked(catalogRepository.findActiveOrdered).mockResolvedValue([catalog]);
    vi.mocked(folderRepository.countByCatalogId).mockResolvedValue(3);

    const result = await directoryService.getDirectory();

    expect(result.catalogs).toHaveLength(1);
    expect(result.catalogs[0]).toMatchObject({
      id: catalog.id,
      name: "Embragues",
      sectionCount: 3,
      coverImageUrl: "https://example.com/signed-url",
      offlineSync: { status: "unavailable" },
    });
    expect(offlineSyncService.getLastServerVersion).toHaveBeenCalled();
    expect(folderRepository.countByCatalogId).toHaveBeenCalledWith(catalog.id, {
      visibleToNormalUser: true,
      status: "ACTIVE",
    });
    expect(result.generatedAt).toEqual(expect.any(String));
  });

  it("USUARIO excluye catálogos ocultos", async () => {
    const visibleCatalog = createCatalogFixture({ visibleToNormalUser: true });
    const hiddenCatalog = createCatalogFixture({
      id: "hidden-catalog",
      visibleToNormalUser: false,
    });
    vi.mocked(catalogRepository.findActiveOrdered).mockResolvedValue([
      visibleCatalog,
      hiddenCatalog,
    ]);

    const result = await directoryService.getDirectory();

    expect(result.catalogs).toHaveLength(1);
    expect(result.catalogs[0]?.id).toBe(visibleCatalog.id);
  });

  it("ADMIN cuenta todas las carpetas del catálogo", async () => {
    mockRequireAuth(adminUserFixture);
    const catalog = createCatalogFixture();
    vi.mocked(catalogRepository.findActiveOrdered).mockResolvedValue([catalog]);

    await directoryService.getDirectory();

    expect(folderRepository.countByCatalogId).toHaveBeenCalledWith(catalog.id, {});
  });

  it("usa coverImageUrl null si falla la URL firmada", async () => {
    const catalog = createCatalogFixture({
      coverImagePath: "catalogs/rulemanes/cover.jpg",
    });
    vi.mocked(catalogRepository.findActiveOrdered).mockResolvedValue([catalog]);
    vi.mocked(createSignedDownloadUrl).mockRejectedValue(new Error("storage down"));

    const result = await directoryService.getDirectory();

    expect(result.catalogs[0]?.coverImageUrl).toBeNull();
  });
});
