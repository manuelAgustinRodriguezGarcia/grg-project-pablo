import type { PriceList, PriceListStatus } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type CreatePriceListData = {
  name: string;
  description?: string | null;
  status?: PriceListStatus;
  order?: number;
  visibleToNormalUser?: boolean;
  sourceUploadedFileId?: string | null;
};

export type UpdatePriceListData = Partial<{
  name: string;
  description: string | null;
  status: PriceListStatus;
  order: number;
  visibleToNormalUser: boolean;
  sourceUploadedFileId: string | null;
}>;

export type PriceListWithItemCount = PriceList & { itemCount: number };

export type ReorderPriceListItem = {
  id: string;
  order: number;
};

export class PriceListRepository {
  async findAllOrdered(
    where: Prisma.PriceListWhereInput = {},
  ): Promise<PriceListWithItemCount[]> {
    const lists = await prisma.priceList.findMany({
      where,
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return lists.map(({ _count, ...list }) => ({
      ...list,
      itemCount: _count.items,
    }));
  }

  async findById(id: string): Promise<PriceList | null> {
    return prisma.priceList.findUnique({ where: { id } });
  }

  async findByIdWithItemCount(
    id: string,
  ): Promise<PriceListWithItemCount | null> {
    const list = await prisma.priceList.findUnique({
      where: { id },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    if (!list) {
      return null;
    }

    const { _count, ...rest } = list;
    return { ...rest, itemCount: _count.items };
  }

  async create(data: CreatePriceListData): Promise<PriceList> {
    return prisma.priceList.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? "ACTIVE",
        order: data.order ?? 0,
        visibleToNormalUser: data.visibleToNormalUser ?? true,
        sourceUploadedFileId: data.sourceUploadedFileId ?? null,
      },
    });
  }

  async update(id: string, data: UpdatePriceListData): Promise<PriceList> {
    return prisma.priceList.update({ where: { id }, data });
  }

  async delete(id: string): Promise<PriceList> {
    return prisma.priceList.delete({ where: { id } });
  }

  async clearItems(id: string): Promise<number> {
    const result = await prisma.priceItem.deleteMany({
      where: { priceListId: id },
    });
    return result.count;
  }

  async reorder(items: ReorderPriceListItem[]): Promise<void> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.priceList.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );
  }

  async getNextOrder(): Promise<number> {
    const result = await prisma.priceList.aggregate({
      _max: { order: true },
    });
    return (result._max.order ?? -1) + 1;
  }

  async countByName(name: string, excludeId?: string): Promise<number> {
    return prisma.priceList.count({
      where: {
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

export const priceListRepository = new PriceListRepository();
