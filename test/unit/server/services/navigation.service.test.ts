import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/server/auth/errors";
import { requireAuth } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { createSignedDownloadUrl } from "@/server/storage";
import { navigationService } from "@/server/services/navigation.service";
import {
  adminUserFixture,
  consultaUserFixture,
  mockRequireAuth,
  mockRequireAuthUnauthenticated,
} from "../../../helpers/mocks/auth";
import { createCatalogFixture, CATALOG_ID } from "../../../helpers/fixtures/catalog.fixture";
import { createFolderWithProductCountFixture } from "../../../helpers/fixtures/folder.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/server/repositories/catalog.repository", () => ({
  catalogRepository: {
    findById: vi.fn(),
  },
}));
vi.mock("@/server/repositories/folder.repository", () => ({
  folderRepository: {
    findByCatalogIdOrdered: vi.fn(),
  },
}));
vi.mock("@/server/storage", () => ({
  createSignedDownloadUrl: vi.fn(),
}));

describe("NavigationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth(consultaUserFixture);
    vi.mocked(catalogRepository.findById).mockResolvedValue(
      createCatalogFixture({ coverImagePath: "catalogs/test/cover.jpg" }),
    );
    vi.mocked(folderRepository.findByCatalogIdOrdered).mockResolvedValue([
      createFolderWithProductCountFixture({ productCount: 12 }),
    ]);
    vi.mocked(createSignedDownloadUrl).mockResolvedValue({
      signedUrl: "https://example.com/signed-url",
      bucket: "product-images",
      path: "catalogs/test/cover.jpg",
      expiresInSeconds: 3600,
    });
  });

  it("exige autenticación", async () => {
    mockRequireAuthUnauthenticated();

    await expect(navigationService.getCatalogNavigation(CATALOG_ID)).rejects.toBeInstanceOf(
      AuthError,
    );
    expect(requireAuth).toHaveBeenCalled();
  });

  it("devuelve metadatos del catálogo y carpetas visibles", async () => {
    const result = await navigationService.getCatalogNavigation(CATALOG_ID);

    expect(result.catalog.id).toBe(CATALOG_ID);
    expect(result.catalog.coverImageUrl).toBe("https://example.com/signed-url");
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0]?.productCount).toBe(12);
    expect(folderRepository.findByCatalogIdOrdered).toHaveBeenCalledWith(
      CATALOG_ID,
      { visibleToNormalUser: true, status: "ACTIVE" },
    );
  });

  it("ADMIN consulta sin filtro adicional en repositorio de carpetas", async () => {
    mockRequireAuth(adminUserFixture);

    await navigationService.getCatalogNavigation(CATALOG_ID);

    expect(folderRepository.findByCatalogIdOrdered).toHaveBeenCalledWith(CATALOG_ID, {});
  });

  it("CONSULTA no accede a catálogo oculto", async () => {
    vi.mocked(catalogRepository.findById).mockResolvedValue(
      createCatalogFixture({ visibleToNormalUser: false }),
    );

    await expect(
      navigationService.getCatalogNavigation(CATALOG_ID),
    ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });
  });
});
