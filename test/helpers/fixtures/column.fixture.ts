import type { FolderColumn } from "@/generated/prisma/client";
import { FOLDER_ID } from "./folder.fixture";

const baseDate = new Date("2026-06-19T12:00:00.000Z");

export const COLUMN_ID = "clh3pb1a3000012345678903ef";

export function createColumnFixture(
  overrides: Partial<FolderColumn> = {},
): FolderColumn {
  return {
    id: COLUMN_ID,
    folderId: FOLDER_ID,
    originalName: "Código",
    displayName: "Código",
    internalKey: "codigo",
    dataType: "TEXT",
    order: 0,
    visibleToNormalUser: true,
    isSearchable: true,
    isGloballySearchable: false,
    isFilterable: false,
    isGloballyFilterable: false,
    isAdminEditable: true,
    isPrimaryCode: true,
    isEquivalence: false,
    isDescription: false,
    isImageCode: false,
    isRequired: false,
    isReadOnly: false,
    width: null,
    format: null,
    unit: null,
    label: null,
    globalFieldKey: null,
    helpText: null,
    helpImagePath: null,
    helpImageThumbnailPath: null,
    helpImageMimeType: null,
    helpImageSizeBytes: null,
    helpImageOriginalName: null,
    helpImageAltText: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}
