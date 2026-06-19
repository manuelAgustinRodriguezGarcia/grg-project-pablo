import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/server/auth/errors";
import { requireAuth } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { createSignedDownloadUrl } from "@/server/storage";
import { directoryService } from "@/server/services/directory.service";
import {
  consultaUserFixture,
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
vi.mock("@/server/storage", () => ({
  createSignedDownloadUrl: vi.fn(),
}));

describe("DirectoryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth(consultaUserFixture);
    vi.mocked(createSignedDownloadUrl).mockResolvedValue({
      signedUrl: "https://example.com/signed-url",
      bucket: "product-images",
      path: "catalogs/test/cover.jpg",
      expiresInSeconds: 3600,
    });
    vi.mocked(catalogRepository.findActiveOrdered).mockResolvedValue([]);
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

    const result = await directoryService.getDirectory();

    expect(result.catalogs).toHaveLength(1);
    expect(result.catalogs[0]).toMatchObject({
      id: catalog.id,
      name: "Embragues",
      sectionCount: 0,
      coverImageUrl: "https://example.com/signed-url",
      offlineSync: { status: "unavailable" },
    });
    expect(result.generatedAt).toEqual(expect.any(String));
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
