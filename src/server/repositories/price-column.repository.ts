import type { ColumnDataType, PriceColumn } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type CreatePriceColumnData = {
  priceListId: string;
  originalName: string;
  displayName: string;
  internalKey: string;
  dataType?: ColumnDataType;
  order?: number;
  visibleToNormalUser?: boolean;
  isSearchable?: boolean;
  isFilterable?: boolean;
  isAdminEditable?: boolean;
  isPrimaryCode?: boolean;
  isDescription?: boolean;
  isPrice?: boolean;
  isRequired?: boolean;
  isReadOnly?: boolean;
  width?: number | null;
  format?: string | null;
  unit?: string | null;
  label?: string | null;
  helpText?: string | null;
  helpImageAltText?: string | null;
  helpImagePath?: string | null;
  helpImageThumbnailPath?: string | null;
  helpImageMimeType?: string | null;
  helpImageSizeBytes?: number | null;
  helpImageOriginalName?: string | null;
};

export type UpdatePriceColumnData = Partial<
  Omit<CreatePriceColumnData, "priceListId" | "internalKey"> & {
    internalKey: string;
  }
>;

export type ReorderPriceColumnItem = {
  id: string;
  order: number;
};

export class PriceColumnRepository {
  async findByPriceListIdOrdered(
    priceListId: string,
    where: Prisma.PriceColumnWhereInput = {},
  ): Promise<PriceColumn[]> {
    return prisma.priceColumn.findMany({
      where: { priceListId, ...where },
      orderBy: [{ order: "asc" }, { displayName: "asc" }],
    });
  }

  async findById(id: string): Promise<PriceColumn | null> {
    return prisma.priceColumn.findUnique({ where: { id } });
  }

  async countPrimaryCodeByPriceList(
    priceListId: string,
    excludeId?: string,
  ): Promise<number> {
    return prisma.priceColumn.count({
      where: {
        priceListId,
        isPrimaryCode: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async create(data: CreatePriceColumnData): Promise<PriceColumn> {
    return prisma.priceColumn.create({
      data: {
        priceListId: data.priceListId,
        originalName: data.originalName,
        displayName: data.displayName,
        internalKey: data.internalKey,
        dataType: data.dataType ?? "UNKNOWN",
        order: data.order ?? 0,
        visibleToNormalUser: data.visibleToNormalUser ?? true,
        isSearchable: data.isSearchable ?? false,
        isFilterable: data.isFilterable ?? false,
        isAdminEditable: data.isAdminEditable ?? true,
        isPrimaryCode: data.isPrimaryCode ?? false,
        isDescription: data.isDescription ?? false,
        isPrice: data.isPrice ?? false,
        isRequired: data.isRequired ?? false,
        isReadOnly: data.isReadOnly ?? false,
        width: data.width ?? null,
        format: data.format ?? null,
        unit: data.unit ?? null,
        label: data.label ?? null,
        helpText: data.helpText ?? null,
        helpImageAltText: data.helpImageAltText ?? null,
        helpImagePath: data.helpImagePath ?? null,
        helpImageThumbnailPath: data.helpImageThumbnailPath ?? null,
        helpImageMimeType: data.helpImageMimeType ?? null,
        helpImageSizeBytes: data.helpImageSizeBytes ?? null,
        helpImageOriginalName: data.helpImageOriginalName ?? null,
      },
    });
  }

  async update(id: string, data: UpdatePriceColumnData): Promise<PriceColumn> {
    return prisma.priceColumn.update({ where: { id }, data });
  }

  async delete(id: string): Promise<PriceColumn> {
    return prisma.priceColumn.delete({ where: { id } });
  }

  async reorder(items: ReorderPriceColumnItem[]): Promise<void> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.priceColumn.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );
  }

  async getNextOrder(priceListId: string): Promise<number> {
    const result = await prisma.priceColumn.aggregate({
      where: { priceListId },
      _max: { order: true },
    });
    return (result._max.order ?? -1) + 1;
  }

  async createMany(data: CreatePriceColumnData[]): Promise<number> {
    if (data.length === 0) {
      return 0;
    }

    const result = await prisma.priceColumn.createMany({
      data: data.map((item) => ({
        priceListId: item.priceListId,
        originalName: item.originalName,
        displayName: item.displayName,
        internalKey: item.internalKey,
        dataType: item.dataType ?? "UNKNOWN",
        order: item.order ?? 0,
        visibleToNormalUser: item.visibleToNormalUser ?? true,
        isSearchable: item.isSearchable ?? false,
        isFilterable: item.isFilterable ?? false,
        isAdminEditable: item.isAdminEditable ?? true,
        isPrimaryCode: item.isPrimaryCode ?? false,
        isDescription: item.isDescription ?? false,
        isPrice: item.isPrice ?? false,
        isRequired: item.isRequired ?? false,
        isReadOnly: item.isReadOnly ?? false,
        width: item.width ?? null,
        format: item.format ?? null,
        unit: item.unit ?? null,
        label: item.label ?? null,
        helpText: item.helpText ?? null,
        helpImageAltText: item.helpImageAltText ?? null,
        helpImagePath: item.helpImagePath ?? null,
        helpImageThumbnailPath: item.helpImageThumbnailPath ?? null,
        helpImageMimeType: item.helpImageMimeType ?? null,
        helpImageSizeBytes: item.helpImageSizeBytes ?? null,
        helpImageOriginalName: item.helpImageOriginalName ?? null,
      })),
    });

    return result.count;
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}

export const priceColumnRepository = new PriceColumnRepository();
