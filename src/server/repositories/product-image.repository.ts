import type {
  Prisma,
  ProductImage,
  ProductImageSource,
  ProductImageStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type CreateProductImageData = {
  productId?: string | null;
  importJobId?: string | null;
  storagePath?: string | null;
  thumbnailPath?: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes?: number;
  sortOrder?: number;
  isPrimary?: boolean;
  label?: string | null;
  sourceSheet?: string | null;
  sourceRow?: number | null;
  sourceColumn?: string | null;
  status: ProductImageStatus;
  source: ProductImageSource;
  matchCandidates?: Prisma.InputJsonValue;
  errorMessage?: string | null;
};

export type ProductImageListOptions = {
  page: number;
  pageSize: number;
  status?: ProductImageStatus | ProductImageStatus[];
};

export class ProductImageRepository {
  async create(data: CreateProductImageData): Promise<ProductImage> {
    return prisma.productImage.create({
      data: {
        productId: data.productId ?? null,
        importJobId: data.importJobId ?? null,
        storagePath: data.storagePath ?? null,
        thumbnailPath: data.thumbnailPath ?? null,
        originalName: data.originalName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes ?? 0,
        sortOrder: data.sortOrder ?? 0,
        isPrimary: data.isPrimary ?? false,
        label: data.label ?? null,
        sourceSheet: data.sourceSheet ?? null,
        sourceRow: data.sourceRow ?? null,
        sourceColumn: data.sourceColumn ?? null,
        status: data.status,
        source: data.source,
        matchCandidates: data.matchCandidates,
        errorMessage: data.errorMessage ?? null,
      },
    });
  }

  async createMany(data: CreateProductImageData[]): Promise<number> {
    if (data.length === 0) {
      return 0;
    }

    const result = await prisma.productImage.createMany({
      data: data.map((item) => ({
        productId: item.productId ?? null,
        importJobId: item.importJobId ?? null,
        storagePath: item.storagePath ?? null,
        thumbnailPath: item.thumbnailPath ?? null,
        originalName: item.originalName,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes ?? 0,
        sortOrder: item.sortOrder ?? 0,
        isPrimary: item.isPrimary ?? false,
        label: item.label ?? null,
        sourceSheet: item.sourceSheet ?? null,
        sourceRow: item.sourceRow ?? null,
        sourceColumn: item.sourceColumn ?? null,
        status: item.status,
        source: item.source,
        matchCandidates: item.matchCandidates,
        errorMessage: item.errorMessage ?? null,
      })),
    });

    return result.count;
  }

  async findById(id: string): Promise<ProductImage | null> {
    return prisma.productImage.findUnique({ where: { id } });
  }

  async findByIdAndJob(
    id: string,
    importJobId: string,
  ): Promise<ProductImage | null> {
    return prisma.productImage.findFirst({
      where: { id, importJobId },
    });
  }

  async findByImportJob(
    importJobId: string,
    options: ProductImageListOptions,
  ): Promise<{ items: ProductImage[]; total: number }> {
    const page = Math.max(1, options.page);
    const pageSize = Math.min(Math.max(1, options.pageSize), 200);
    const skip = (page - 1) * pageSize;

    const statusFilter = options.status
      ? Array.isArray(options.status)
        ? { in: options.status }
        : options.status
      : undefined;

    const where: Prisma.ProductImageWhereInput = {
      importJobId,
      ...(statusFilter ? { status: statusFilter } : { status: { not: "DELETED" } }),
    };

    const [items, total] = await Promise.all([
      prisma.productImage.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.productImage.count({ where }),
    ]);

    return { items, total };
  }

  async findByProduct(productId: string): Promise<ProductImage[]> {
    return prisma.productImage.findMany({
      where: { productId, status: { not: "DELETED" } },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async findPrimaryByProductIds(
    productIds: string[],
  ): Promise<ProductImage[]> {
    if (productIds.length === 0) {
      return [];
    }

    return prisma.productImage.findMany({
      where: {
        productId: { in: productIds },
        status: { in: ["ASSOCIATED_AUTO", "ASSOCIATED_MANUAL"] },
        isPrimary: true,
      },
    });
  }

  async countByImportJobAndStatuses(
    importJobId: string,
    statuses: ProductImageStatus[],
  ): Promise<number> {
    return prisma.productImage.count({
      where: { importJobId, status: { in: statuses } },
    });
  }

  async update(
    id: string,
    data: Prisma.ProductImageUpdateInput,
  ): Promise<ProductImage> {
    return prisma.productImage.update({ where: { id }, data });
  }

  async clearPrimaryForProduct(productId: string): Promise<void> {
    await prisma.productImage.updateMany({
      where: { productId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  async deleteByProductIds(productIds: string[]): Promise<number> {
    if (productIds.length === 0) {
      return 0;
    }

    const result = await prisma.productImage.deleteMany({
      where: { productId: { in: productIds } },
    });

    return result.count;
  }

  async deleteByFolderProductIds(folderId: string): Promise<number> {
    const products = await prisma.product.findMany({
      where: { folderId },
      select: { id: true },
    });

    return this.deleteByProductIds(products.map((product) => product.id));
  }
}

export const productImageRepository = new ProductImageRepository();
