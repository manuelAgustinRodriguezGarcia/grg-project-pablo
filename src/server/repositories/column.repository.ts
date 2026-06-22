import type { FolderColumn, ColumnDataType } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type CreateColumnData = {
  folderId: string;
  originalName: string;
  displayName: string;
  internalKey: string;
  dataType?: ColumnDataType;
  order?: number;
  visibleToNormalUser?: boolean;
  isSearchable?: boolean;
  isGloballySearchable?: boolean;
  isFilterable?: boolean;
  isGloballyFilterable?: boolean;
  isAdminEditable?: boolean;
  isPrimaryCode?: boolean;
  isEquivalence?: boolean;
  isDescription?: boolean;
  isImageCode?: boolean;
  isRequired?: boolean;
  isReadOnly?: boolean;
  width?: number | null;
  format?: string | null;
  unit?: string | null;
  label?: string | null;
  globalFieldKey?: string | null;
};

export type UpdateColumnData = Partial<
  Omit<CreateColumnData, "folderId" | "internalKey"> & {
    internalKey: string;
  }
>;

export type ReorderColumnItem = {
  id: string;
  order: number;
};

export class ColumnRepository {
  async findByFolderIdOrdered(
    folderId: string,
    where: Prisma.FolderColumnWhereInput = {},
  ): Promise<FolderColumn[]> {
    return prisma.folderColumn.findMany({
      where: { folderId, ...where },
      orderBy: [{ order: "asc" }, { displayName: "asc" }],
    });
  }

  async findById(id: string): Promise<FolderColumn | null> {
    return prisma.folderColumn.findUnique({
      where: { id },
    });
  }

  async findManyByIds(ids: string[]): Promise<FolderColumn[]> {
    if (ids.length === 0) {
      return [];
    }

    return prisma.folderColumn.findMany({
      where: { id: { in: ids } },
    });
  }

  async countPrimaryCodeByFolder(
    folderId: string,
    excludeId?: string,
  ): Promise<number> {
    return prisma.folderColumn.count({
      where: {
        folderId,
        isPrimaryCode: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async create(data: CreateColumnData): Promise<FolderColumn> {
    return prisma.folderColumn.create({
      data: {
        folderId: data.folderId,
        originalName: data.originalName,
        displayName: data.displayName,
        internalKey: data.internalKey,
        dataType: data.dataType ?? "UNKNOWN",
        order: data.order ?? 0,
        visibleToNormalUser: data.visibleToNormalUser ?? true,
        isSearchable: data.isSearchable ?? false,
        isGloballySearchable: data.isGloballySearchable ?? false,
        isFilterable: data.isFilterable ?? false,
        isGloballyFilterable: data.isGloballyFilterable ?? false,
        isAdminEditable: data.isAdminEditable ?? true,
        isPrimaryCode: data.isPrimaryCode ?? false,
        isEquivalence: data.isEquivalence ?? false,
        isDescription: data.isDescription ?? false,
        isImageCode: data.isImageCode ?? false,
        isRequired: data.isRequired ?? false,
        isReadOnly: data.isReadOnly ?? false,
        width: data.width ?? null,
        format: data.format ?? null,
        unit: data.unit ?? null,
        label: data.label ?? null,
        globalFieldKey: data.globalFieldKey ?? null,
      },
    });
  }

  async update(id: string, data: UpdateColumnData): Promise<FolderColumn> {
    return prisma.folderColumn.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<FolderColumn> {
    return prisma.folderColumn.delete({
      where: { id },
    });
  }

  async reorder(items: ReorderColumnItem[]): Promise<void> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.folderColumn.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );
  }

  async getNextOrder(folderId: string): Promise<number> {
    const result = await prisma.folderColumn.aggregate({
      where: { folderId },
      _max: { order: true },
    });

    return (result._max.order ?? -1) + 1;
  }

  async createMany(data: CreateColumnData[]): Promise<number> {
    if (data.length === 0) {
      return 0;
    }

    const result = await prisma.folderColumn.createMany({ data: data.map((item) => ({
      folderId: item.folderId,
      originalName: item.originalName,
      displayName: item.displayName,
      internalKey: item.internalKey,
      dataType: item.dataType ?? "UNKNOWN",
      order: item.order ?? 0,
      visibleToNormalUser: item.visibleToNormalUser ?? true,
      isSearchable: item.isSearchable ?? false,
      isGloballySearchable: item.isGloballySearchable ?? false,
      isFilterable: item.isFilterable ?? false,
      isGloballyFilterable: item.isGloballyFilterable ?? false,
      isAdminEditable: item.isAdminEditable ?? true,
      isPrimaryCode: item.isPrimaryCode ?? false,
      isEquivalence: item.isEquivalence ?? false,
      isDescription: item.isDescription ?? false,
      isImageCode: item.isImageCode ?? false,
      isRequired: item.isRequired ?? false,
      isReadOnly: item.isReadOnly ?? false,
      width: item.width ?? null,
      format: item.format ?? null,
      unit: item.unit ?? null,
      label: item.label ?? null,
      globalFieldKey: item.globalFieldKey ?? null,
    })) });

    return result.count;
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}

export const columnRepository = new ColumnRepository();
