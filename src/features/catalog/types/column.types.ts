import type { FolderColumn } from "@/generated/prisma/client";

export type ColumnActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type ColumnListItem = {
  id: string;
  folderId: string;
  originalName: string;
  displayName: string;
  internalKey: string;
  dataType: FolderColumn["dataType"];
  order: number;
  visibleToNormalUser: boolean;
  isSearchable: boolean;
  isGloballySearchable: boolean;
  isFilterable: boolean;
  isGloballyFilterable: boolean;
  isAdminEditable: boolean;
  isPrimaryCode: boolean;
  isEquivalence: boolean;
  isDescription: boolean;
  isImageCode: boolean;
  isRequired: boolean;
  isReadOnly: boolean;
  width: number | null;
  format: string | null;
  unit: string | null;
  label: string | null;
  globalFieldKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toColumnListItem(column: FolderColumn): ColumnListItem {
  return {
    id: column.id,
    folderId: column.folderId,
    originalName: column.originalName,
    displayName: column.displayName,
    internalKey: column.internalKey,
    dataType: column.dataType,
    order: column.order,
    visibleToNormalUser: column.visibleToNormalUser,
    isSearchable: column.isSearchable,
    isGloballySearchable: column.isGloballySearchable,
    isFilterable: column.isFilterable,
    isGloballyFilterable: column.isGloballyFilterable,
    isAdminEditable: column.isAdminEditable,
    isPrimaryCode: column.isPrimaryCode,
    isEquivalence: column.isEquivalence,
    isDescription: column.isDescription,
    isImageCode: column.isImageCode,
    isRequired: column.isRequired,
    isReadOnly: column.isReadOnly,
    width: column.width,
    format: column.format,
    unit: column.unit,
    label: column.label,
    globalFieldKey: column.globalFieldKey,
    createdAt: column.createdAt.toISOString(),
    updatedAt: column.updatedAt.toISOString(),
  };
}
