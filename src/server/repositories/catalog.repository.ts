import type { Catalog, CatalogStatus } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type CreateCatalogData = {
  name: string;
  description?: string | null;
  status?: CatalogStatus;
  order?: number;
  visibleToNormalUser?: boolean;
  coverImagePath?: string | null;
};

export type UpdateCatalogData = Partial<
  Pick<
    Catalog,
    | "name"
    | "description"
    | "status"
    | "order"
    | "visibleToNormalUser"
    | "coverImagePath"
  >
>;

export type CatalogWithFolderCount = Catalog & { folderCount: number };

export type ReorderCatalogItem = {
  id: string;
  order: number;
};

export class CatalogRepository {
  async findActiveOrdered(
    where: Prisma.CatalogWhereInput = {},
  ): Promise<Catalog[]> {
    return prisma.catalog.findMany({
      where: { status: "ACTIVE", ...where },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
  }

  async findAllOrdered(): Promise<Catalog[]> {
    return prisma.catalog.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
  }

  async findAllOrderedWithFolderCount(): Promise<CatalogWithFolderCount[]> {
    const catalogs = await prisma.catalog.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { folders: true },
        },
      },
    });

    return catalogs.map(({ _count, ...catalog }) => ({
      ...catalog,
      folderCount: _count.folders,
    }));
  }

  async findById(id: string): Promise<Catalog | null> {
    return prisma.catalog.findUnique({
      where: { id },
    });
  }

  async findByIdWithFolderCount(
    id: string,
  ): Promise<CatalogWithFolderCount | null> {
    const catalog = await prisma.catalog.findUnique({
      where: { id },
      include: {
        _count: {
          select: { folders: true },
        },
      },
    });

    if (!catalog) {
      return null;
    }

    const { _count, ...rest } = catalog;
    return {
      ...rest,
      folderCount: _count.folders,
    };
  }

  async create(data: CreateCatalogData): Promise<Catalog> {
    return prisma.catalog.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? "ACTIVE",
        order: data.order ?? 0,
        visibleToNormalUser: data.visibleToNormalUser ?? true,
        coverImagePath: data.coverImagePath ?? null,
      },
    });
  }

  async update(id: string, data: UpdateCatalogData): Promise<Catalog> {
    return prisma.catalog.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Catalog> {
    return prisma.catalog.delete({
      where: { id },
    });
  }

  async clearProducts(catalogId: string): Promise<number> {
    const result = await prisma.product.deleteMany({
      where: {
        folder: {
          catalogId,
        },
      },
    });

    return result.count;
  }

  async reorder(items: ReorderCatalogItem[]): Promise<void> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.catalog.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );
  }

  async getNextOrder(): Promise<number> {
    const result = await prisma.catalog.aggregate({
      _max: { order: true },
    });

    return (result._max.order ?? -1) + 1;
  }

  async countFolders(catalogId: string): Promise<number> {
    return prisma.catalogFolder.count({
      where: { catalogId },
    });
  }

  async findManyByIds(ids: string[]): Promise<Catalog[]> {
    if (ids.length === 0) {
      return [];
    }

    return prisma.catalog.findMany({
      where: { id: { in: ids } },
    });
  }

  async countProducts(catalogId: string): Promise<number> {
    return prisma.product.count({
      where: {
        folder: {
          catalogId,
        },
      },
    });
  }
}

export const catalogRepository = new CatalogRepository();
