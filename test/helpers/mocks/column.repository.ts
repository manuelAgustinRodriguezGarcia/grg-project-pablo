import { vi } from "vitest";
import { columnRepository } from "@/server/repositories/column.repository";
import { createColumnFixture } from "../fixtures/column.fixture";

export function setupColumnRepositoryMocks(): void {
  vi.mocked(columnRepository.findByFolderIdOrdered).mockResolvedValue([]);
  vi.mocked(columnRepository.findById).mockResolvedValue(null);
  vi.mocked(columnRepository.findManyByIds).mockResolvedValue([]);
  vi.mocked(columnRepository.countPrimaryCodeByFolder).mockResolvedValue(0);
  vi.mocked(columnRepository.create).mockImplementation(async (data) =>
    createColumnFixture({
      folderId: data.folderId,
      originalName: data.originalName,
      displayName: data.displayName,
      internalKey: data.internalKey,
      dataType: data.dataType,
      order: data.order,
      visibleToNormalUser: data.visibleToNormalUser,
      isSearchable: data.isSearchable,
      isGloballySearchable: data.isGloballySearchable,
      isFilterable: data.isFilterable,
      isGloballyFilterable: data.isGloballyFilterable,
      isAdminEditable: data.isAdminEditable,
      isPrimaryCode: data.isPrimaryCode,
      isEquivalence: data.isEquivalence,
      isDescription: data.isDescription,
      isImageCode: data.isImageCode,
      isRequired: data.isRequired,
      isReadOnly: data.isReadOnly,
      width: data.width ?? null,
      format: data.format ?? null,
      unit: data.unit ?? null,
      label: data.label ?? null,
      globalFieldKey: data.globalFieldKey ?? null,
    }),
  );
  vi.mocked(columnRepository.update).mockImplementation(async (id, data) =>
    createColumnFixture({ id, ...data }),
  );
  vi.mocked(columnRepository.delete).mockResolvedValue(createColumnFixture());
  vi.mocked(columnRepository.reorder).mockResolvedValue(undefined);
  vi.mocked(columnRepository.getNextOrder).mockResolvedValue(0);
  vi.mocked(columnRepository.isUniqueConstraintError).mockReturnValue(false);
}

export function mockColumnExists(
  overrides: Parameters<typeof createColumnFixture>[0] = {},
): void {
  vi.mocked(columnRepository.findById).mockResolvedValue(
    createColumnFixture(overrides),
  );
}
