import { vi } from "vitest";
import { catalogRepository } from "@/server/repositories/catalog.repository";

export function setupCatalogRepositoryMocks(): void {
  vi.mocked(catalogRepository.findActiveOrdered).mockResolvedValue([]);
  vi.mocked(catalogRepository.findAllOrdered).mockResolvedValue([]);
  vi.mocked(catalogRepository.findAllOrderedWithFolderCount).mockResolvedValue([]);
  vi.mocked(catalogRepository.findById).mockResolvedValue(null);
  vi.mocked(catalogRepository.findByIdWithFolderCount).mockResolvedValue(null);
  vi.mocked(catalogRepository.create).mockImplementation(async (data) => ({
    id: "clh3pb1a3000012345678901ab",
    name: data.name,
    description: data.description ?? null,
    status: data.status ?? "ACTIVE",
    order: data.order ?? 0,
    visibleToNormalUser: data.visibleToNormalUser ?? true,
    coverImagePath: data.coverImagePath ?? null,
    createdAt: new Date("2026-06-19T12:00:00.000Z"),
    updatedAt: new Date("2026-06-19T12:00:00.000Z"),
  }));
  vi.mocked(catalogRepository.update).mockImplementation(async (id, data) => ({
    id,
    name: data.name ?? "Rulemanes",
    description: data.description ?? null,
    status: data.status ?? "ACTIVE",
    order: data.order ?? 0,
    visibleToNormalUser: data.visibleToNormalUser ?? true,
    coverImagePath: data.coverImagePath ?? null,
    createdAt: new Date("2026-06-19T12:00:00.000Z"),
    updatedAt: new Date("2026-06-19T12:00:00.000Z"),
  }));
  vi.mocked(catalogRepository.delete).mockImplementation(async (id) => ({
    id,
    name: "Rulemanes",
    description: null,
    status: "ACTIVE",
    order: 0,
    visibleToNormalUser: true,
    coverImagePath: null,
    createdAt: new Date("2026-06-19T12:00:00.000Z"),
    updatedAt: new Date("2026-06-19T12:00:00.000Z"),
  }));
  vi.mocked(catalogRepository.clearProducts).mockResolvedValue(0);
  vi.mocked(catalogRepository.reorder).mockResolvedValue(undefined);
  vi.mocked(catalogRepository.getNextOrder).mockResolvedValue(1);
  vi.mocked(catalogRepository.countFolders).mockResolvedValue(0);
  vi.mocked(catalogRepository.findManyByIds).mockResolvedValue([]);
  vi.mocked(catalogRepository.countProducts).mockResolvedValue(0);
}
