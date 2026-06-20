import { vi } from "vitest";
import { folderRepository } from "@/server/repositories/folder.repository";
import {
  createFolderFixture,
  createFolderWithProductCountFixture,
  FOLDER_ID,
} from "../fixtures/folder.fixture";

export function setupFolderRepositoryMocks(): void {
  vi.mocked(folderRepository.findByCatalogIdOrdered).mockResolvedValue([]);
  vi.mocked(folderRepository.findById).mockResolvedValue(null);
  vi.mocked(folderRepository.findByIdWithProductCount).mockResolvedValue(null);
  vi.mocked(folderRepository.create).mockImplementation(async (data) =>
    createFolderFixture({
      catalogId: data.catalogId,
      name: data.name,
      description: data.description ?? null,
      status: data.status ?? "ACTIVE",
      order: data.order ?? 0,
      visibleToNormalUser: data.visibleToNormalUser ?? true,
      searchConfig: data.searchConfig ?? null,
      filterConfig: data.filterConfig ?? null,
    }),
  );
  vi.mocked(folderRepository.update).mockImplementation(async (id, data) =>
    createFolderFixture({
      id,
      name: data.name ?? "Rodamientos",
      description: data.description ?? null,
      status: data.status ?? "ACTIVE",
      order: data.order ?? 0,
      visibleToNormalUser: data.visibleToNormalUser ?? true,
      searchConfig: data.searchConfig ?? null,
      filterConfig: data.filterConfig ?? null,
    }),
  );
  vi.mocked(folderRepository.delete).mockImplementation(async (id) =>
    createFolderFixture({ id }),
  );
  vi.mocked(folderRepository.clearProducts).mockResolvedValue(0);
  vi.mocked(folderRepository.reorder).mockResolvedValue(undefined);
  vi.mocked(folderRepository.getNextOrder).mockResolvedValue(1);
  vi.mocked(folderRepository.findManyByIds).mockResolvedValue([]);
  vi.mocked(folderRepository.countByCatalogAndName).mockResolvedValue(0);
  vi.mocked(folderRepository.countByCatalogId).mockResolvedValue(0);
  vi.mocked(folderRepository.isUniqueConstraintError).mockReturnValue(false);
}

export function mockFolderExists(): void {
  vi.mocked(folderRepository.findByIdWithProductCount).mockResolvedValue(
    createFolderWithProductCountFixture(),
  );
  vi.mocked(folderRepository.findManyByIds).mockResolvedValue([
    createFolderFixture({ id: FOLDER_ID }),
  ]);
}
