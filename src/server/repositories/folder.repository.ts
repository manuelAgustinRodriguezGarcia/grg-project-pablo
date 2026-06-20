import type { CatalogFolder, FolderStatus } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type FolderColumnKeysConfig = {
  columnInternalKeys: string[];
};

export type CreateFolderData = {
  catalogId: string;
  name: string;
  description?: string | null;
  status?: FolderStatus;
  order?: number;
  visibleToNormalUser?: boolean;
  searchConfig?: FolderColumnKeysConfig | null;
  filterConfig?: FolderColumnKeysConfig | null;
};

export type UpdateFolderData = Partial<
  Pick<
    CatalogFolder,
    | "name"
    | "description"
    | "status"
    | "order"
    | "visibleToNormalUser"
    | "searchConfig"
    | "filterConfig"
  >
>;

export type FolderWithProductCount = CatalogFolder & { productCount: number };

export type ReorderFolderItem = {
  id: string;
  order: number;
};

export class FolderRepository {
  async findByCatalogIdOrdered(
    catalogId: string,
    where: Prisma.CatalogFolderWhereInput = {},
  ): Promise<FolderWithProductCount[]> {
    const folders = await prisma.catalogFolder.findMany({
      where: { catalogId, ...where },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return folders.map(({ _count, ...folder }) => ({
      ...folder,
      productCount: _count.products,
    }));
  }

  async findById(id: string): Promise<CatalogFolder | null> {
    return prisma.catalogFolder.findUnique({
      where: { id },
    });
  }

  async findByIdWithProductCount(
    id: string,
  ): Promise<FolderWithProductCount | null> {
    const folder = await prisma.catalogFolder.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!folder) {
      return null;
    }

    const { _count, ...rest } = folder;
    return {
      ...rest,
      productCount: _count.products,
    };
  }

  async create(data: CreateFolderData): Promise<CatalogFolder> {
    return prisma.catalogFolder.create({
      data: {
        catalogId: data.catalogId,
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? "ACTIVE",
        order: data.order ?? 0,
        visibleToNormalUser: data.visibleToNormalUser ?? true,
        searchConfig: data.searchConfig ?? undefined,
        filterConfig: data.filterConfig ?? undefined,
      },
    });
  }

  async update(id: string, data: UpdateFolderData): Promise<CatalogFolder> {
    return prisma.catalogFolder.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<CatalogFolder> {
    return prisma.catalogFolder.delete({
      where: { id },
    });
  }

  async clearProducts(folderId: string): Promise<number> {
    const result = await prisma.product.deleteMany({
      where: { folderId },
    });

    return result.count;
  }

  async reorder(items: ReorderFolderItem[]): Promise<void> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.catalogFolder.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );
  }

  async getNextOrder(catalogId: string): Promise<number> {
    const result = await prisma.catalogFolder.aggregate({
      where: { catalogId },
      _max: { order: true },
    });

    return (result._max.order ?? -1) + 1;
  }

  async findManyByIds(ids: string[]): Promise<CatalogFolder[]> {
    if (ids.length === 0) {
      return [];
    }

    return prisma.catalogFolder.findMany({
      where: { id: { in: ids } },
    });
  }

  async countByCatalogId(
    catalogId: string,
    where: Prisma.CatalogFolderWhereInput = {},
  ): Promise<number> {
    return prisma.catalogFolder.count({
      where: { catalogId, ...where },
    });
  }

  async countByCatalogAndName(
    catalogId: string,
    name: string,
    excludeId?: string,
  ): Promise<number> {
    return prisma.catalogFolder.count({
      where: {
        catalogId,
        name,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}

export const folderRepository = new FolderRepository();
