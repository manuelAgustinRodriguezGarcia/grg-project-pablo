import type { ProductFieldAnnotation } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type UpsertFieldAnnotationData = {
  productId: string;
  columnInternalKey: string;
  helpText?: string | null;
  helpImagePath?: string | null;
  helpImageThumbnailPath?: string | null;
  helpImageMimeType?: string | null;
  helpImageSizeBytes?: number | null;
  helpImageOriginalName?: string | null;
  helpImageAltText?: string | null;
};

export type UpdateFieldAnnotationData = Partial<
  Omit<UpsertFieldAnnotationData, "productId" | "columnInternalKey">
>;

export class ProductFieldAnnotationRepository {
  async findByProductId(productId: string): Promise<ProductFieldAnnotation[]> {
    return prisma.productFieldAnnotation.findMany({
      where: { productId },
    });
  }

  async findByProductIds(productIds: string[]): Promise<ProductFieldAnnotation[]> {
    if (productIds.length === 0) {
      return [];
    }

    return prisma.productFieldAnnotation.findMany({
      where: { productId: { in: productIds } },
    });
  }

  async findByProductAndKey(
    productId: string,
    columnInternalKey: string,
  ): Promise<ProductFieldAnnotation | null> {
    return prisma.productFieldAnnotation.findUnique({
      where: {
        productId_columnInternalKey: {
          productId,
          columnInternalKey,
        },
      },
    });
  }

  async upsert(data: UpsertFieldAnnotationData): Promise<ProductFieldAnnotation> {
    return prisma.productFieldAnnotation.upsert({
      where: {
        productId_columnInternalKey: {
          productId: data.productId,
          columnInternalKey: data.columnInternalKey,
        },
      },
      create: {
        productId: data.productId,
        columnInternalKey: data.columnInternalKey,
        helpText: data.helpText ?? null,
        helpImagePath: data.helpImagePath ?? null,
        helpImageThumbnailPath: data.helpImageThumbnailPath ?? null,
        helpImageMimeType: data.helpImageMimeType ?? null,
        helpImageSizeBytes: data.helpImageSizeBytes ?? null,
        helpImageOriginalName: data.helpImageOriginalName ?? null,
        helpImageAltText: data.helpImageAltText ?? null,
      },
      update: {
        ...(data.helpText !== undefined ? { helpText: data.helpText } : {}),
        ...(data.helpImagePath !== undefined ? { helpImagePath: data.helpImagePath } : {}),
        ...(data.helpImageThumbnailPath !== undefined
          ? { helpImageThumbnailPath: data.helpImageThumbnailPath }
          : {}),
        ...(data.helpImageMimeType !== undefined
          ? { helpImageMimeType: data.helpImageMimeType }
          : {}),
        ...(data.helpImageSizeBytes !== undefined
          ? { helpImageSizeBytes: data.helpImageSizeBytes }
          : {}),
        ...(data.helpImageOriginalName !== undefined
          ? { helpImageOriginalName: data.helpImageOriginalName }
          : {}),
        ...(data.helpImageAltText !== undefined
          ? { helpImageAltText: data.helpImageAltText }
          : {}),
      },
    });
  }

  async updateHelpText(
    productId: string,
    columnInternalKey: string,
    helpText: string | null,
  ): Promise<ProductFieldAnnotation> {
    return this.upsert({
      productId,
      columnInternalKey,
      helpText,
    });
  }

  async deleteByProductAndKey(
    productId: string,
    columnInternalKey: string,
  ): Promise<void> {
    await prisma.productFieldAnnotation.deleteMany({
      where: { productId, columnInternalKey },
    });
  }

  async deleteByProductId(productId: string): Promise<void> {
    await prisma.productFieldAnnotation.deleteMany({
      where: { productId },
    });
  }

  async deleteEmptyAnnotations(productId: string): Promise<void> {
    await prisma.productFieldAnnotation.deleteMany({
      where: {
        productId,
        helpText: null,
        helpImagePath: null,
      },
    });
  }
}

export const productFieldAnnotationRepository = new ProductFieldAnnotationRepository();
