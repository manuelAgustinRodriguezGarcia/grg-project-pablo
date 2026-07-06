import type { ProductFieldAnnotation } from "@/generated/prisma/client";
import { requireRole } from "@/server/auth";
import {
  buildProductFieldHelpImageStoragePaths,
  generateThumbnail,
  validateImageBuffer,
} from "@/server/image-processors";
import { columnRepository } from "@/server/repositories/column.repository";
import { productFieldAnnotationRepository } from "@/server/repositories/product-field-annotation.repository";
import { productRepository } from "@/server/repositories/product.repository";
import {
  BUCKET_CONFIGS,
  createSignedDownloadUrl,
  deleteFile,
  STORAGE_BUCKETS,
  uploadFile,
} from "@/server/storage";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { ProductFieldAnnotationError } from "./product-field-annotation.errors";
import {
  hasFieldAnnotation,
  assertFieldHelpTextLength,
  normalizeFieldHelpImageAltText,
  normalizeFieldHelpText,
  type ProductFieldAnnotationDisplay,
  type ProductFieldAnnotationResolved,
} from "./product-field-annotation.utils";

export type FieldAnnotationInput = {
  helpText?: string | null;
  removeImage?: boolean;
};

async function requireProduct(productId: string) {
  const product = await productRepository.findById(productId);
  if (!product) {
    throw new ProductFieldAnnotationError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
  }

  return product;
}

async function assertColumnKeyInFolder(
  folderId: string,
  columnInternalKey: string,
): Promise<void> {
  const columns = await columnRepository.findByFolderIdOrdered(folderId);
  const exists = columns.some((column) => column.internalKey === columnInternalKey);
  if (!exists) {
    throw new ProductFieldAnnotationError(
      `Columna desconocida: ${columnInternalKey}.`,
      "VALIDATION_ERROR",
    );
  }
}

async function deleteHelpImageFilesBestEffort(
  annotation: Pick<ProductFieldAnnotation, "helpImagePath" | "helpImageThumbnailPath">,
): Promise<void> {
  const paths = [annotation.helpImagePath, annotation.helpImageThumbnailPath].filter(
    (path): path is string => Boolean(path),
  );

  for (const path of paths) {
    try {
      await deleteFile(STORAGE_BUCKETS.PRODUCT_FIELD_HELP_IMAGES, path);
    } catch {
      // best effort
    }
  }
}

function toResolvedAnnotation(
  annotation: ProductFieldAnnotation,
  urls: { thumbnailUrl: string | null; fullUrl: string | null },
): ProductFieldAnnotationResolved {
  return {
    columnInternalKey: annotation.columnInternalKey,
    helpText: annotation.helpText,
    helpImageAltText: annotation.helpImageAltText,
    thumbnailUrl: urls.thumbnailUrl,
    fullUrl: urls.fullUrl,
    hasAnnotation: hasFieldAnnotation(annotation),
  };
}

export class ProductFieldAnnotationService {
  async resolveImageUrls(
    annotation: ProductFieldAnnotation,
    includeFullUrls = true,
  ): Promise<{ thumbnailUrl: string | null; fullUrl: string | null }> {
    if (!annotation.helpImagePath) {
      return { thumbnailUrl: null, fullUrl: null };
    }

    const [preview, full] = await Promise.all([
      annotation.helpImageThumbnailPath
        ? createSignedDownloadUrl(
            STORAGE_BUCKETS.PRODUCT_FIELD_HELP_IMAGES,
            annotation.helpImageThumbnailPath,
          ).then((result) => result.signedUrl)
        : Promise.resolve(null),
      includeFullUrls
        ? createSignedDownloadUrl(
            STORAGE_BUCKETS.PRODUCT_FIELD_HELP_IMAGES,
            annotation.helpImagePath,
          ).then((result) => result.signedUrl)
        : Promise.resolve(null),
    ]);

    return {
      thumbnailUrl: preview ?? full,
      fullUrl: full ?? preview,
    };
  }

  async resolveForProduct(
    productId: string,
    includeFullUrls = true,
  ): Promise<ProductFieldAnnotationResolved[]> {
    const annotations = await productFieldAnnotationRepository.findByProductId(productId);

    return Promise.all(
      annotations.map(async (annotation) => {
        const urls = await this.resolveImageUrls(annotation, includeFullUrls);
        return toResolvedAnnotation(annotation, urls);
      }),
    );
  }

  async resolveForProducts(
    productIds: string[],
    options: { includeFullUrls?: boolean } = {},
  ): Promise<Map<string, Record<string, ProductFieldAnnotationDisplay>>> {
    const includeFullUrls = options.includeFullUrls !== false;
    const annotations = await productFieldAnnotationRepository.findByProductIds(productIds);
    const result = new Map<string, Record<string, ProductFieldAnnotationDisplay>>();

    await Promise.all(
      annotations.map(async (annotation) => {
        if (!hasFieldAnnotation(annotation)) {
          return;
        }

        const urls = await this.resolveImageUrls(annotation, includeFullUrls);
        const byProduct = result.get(annotation.productId) ?? {};
        byProduct[annotation.columnInternalKey] = {
          helpText: annotation.helpText,
          thumbnailUrl: urls.thumbnailUrl,
          fullUrl: urls.fullUrl,
        };
        result.set(annotation.productId, byProduct);
      }),
    );

    return result;
  }

  async syncFieldAnnotations(
    productId: string,
    folderId: string,
    fieldAnnotations: Record<string, FieldAnnotationInput> | undefined,
  ): Promise<void> {
    if (!fieldAnnotations) {
      return;
    }

    for (const [columnInternalKey, input] of Object.entries(fieldAnnotations)) {
      await assertColumnKeyInFolder(folderId, columnInternalKey);

      const existing = await productFieldAnnotationRepository.findByProductAndKey(
        productId,
        columnInternalKey,
      );

      if (input.removeImage && existing?.helpImagePath) {
        await deleteHelpImageFilesBestEffort(existing);
        await productFieldAnnotationRepository.upsert({
          productId,
          columnInternalKey,
          helpText:
            input.helpText !== undefined
              ? assertFieldHelpTextLength(input.helpText)
              : existing.helpText,
          helpImagePath: null,
          helpImageThumbnailPath: null,
          helpImageMimeType: null,
          helpImageSizeBytes: null,
          helpImageOriginalName: null,
        });
        continue;
      }

      if (input.helpText === undefined && !input.removeImage) {
        continue;
      }

      const helpText =
        input.helpText !== undefined
          ? assertFieldHelpTextLength(input.helpText)
          : (existing?.helpText ?? null);

      if (!helpText && !existing?.helpImagePath) {
        if (existing) {
          await productFieldAnnotationRepository.deleteByProductAndKey(
            productId,
            columnInternalKey,
          );
        }
        continue;
      }

      await productFieldAnnotationRepository.upsert({
        productId,
        columnInternalKey,
        helpText,
        ...(existing?.helpImagePath
          ? {
              helpImagePath: existing.helpImagePath,
              helpImageThumbnailPath: existing.helpImageThumbnailPath,
              helpImageMimeType: existing.helpImageMimeType,
              helpImageSizeBytes: existing.helpImageSizeBytes,
              helpImageOriginalName: existing.helpImageOriginalName,
              helpImageAltText: existing.helpImageAltText,
            }
          : {}),
      });
    }

    await productFieldAnnotationRepository.deleteEmptyAnnotations(productId);
  }

  async uploadFieldHelpImage(input: {
    productId: string;
    columnInternalKey: string;
    buffer: Buffer;
    originalFilename: string;
    altText?: string | null;
  }): Promise<ProductFieldAnnotationResolved> {
    const { profile: admin } = await requireRole("ADMIN");
    const product = await requireProduct(input.productId);
    await assertColumnKeyInFolder(product.folderId, input.columnInternalKey);

    const maxSize =
      BUCKET_CONFIGS[STORAGE_BUCKETS.PRODUCT_FIELD_HELP_IMAGES].maxSizeBytes;
    if (input.buffer.byteLength > maxSize) {
      throw new ProductFieldAnnotationError(
        "La imagen supera el tamaño máximo permitido.",
        "VALIDATION_ERROR",
      );
    }

    const validation = await validateImageBuffer(input.buffer);
    if (!validation.valid) {
      throw new ProductFieldAnnotationError(validation.error, "VALIDATION_ERROR");
    }

    const existing = await productFieldAnnotationRepository.findByProductAndKey(
      input.productId,
      input.columnInternalKey,
    );

    if (existing?.helpImagePath) {
      await deleteHelpImageFilesBestEffort(existing);
    }

    const imageId = crypto.randomUUID();
    const paths = buildProductFieldHelpImageStoragePaths(
      product.folderId,
      product.id,
      input.columnInternalKey,
      imageId,
      input.originalFilename,
    );
    const { thumbnailBuffer } = await generateThumbnail(input.buffer);

    await uploadFile({
      bucket: STORAGE_BUCKETS.PRODUCT_FIELD_HELP_IMAGES,
      path: paths.storagePath,
      body: input.buffer,
      contentType: validation.mimeType,
      originalFilename: input.originalFilename,
    });
    await uploadFile({
      bucket: STORAGE_BUCKETS.PRODUCT_FIELD_HELP_IMAGES,
      path: paths.thumbnailPath,
      body: thumbnailBuffer,
      contentType: "image/webp",
      originalFilename: `${imageId}-thumb.webp`,
    });

    const altText =
      input.altText !== undefined
        ? normalizeFieldHelpImageAltText(input.altText)
        : (existing?.helpImageAltText ?? null);

    const updated = await productFieldAnnotationRepository.upsert({
      productId: input.productId,
      columnInternalKey: input.columnInternalKey,
      helpText: existing?.helpText ?? null,
      helpImagePath: paths.storagePath,
      helpImageThumbnailPath: paths.thumbnailPath,
      helpImageMimeType: validation.mimeType,
      helpImageSizeBytes: input.buffer.byteLength,
      helpImageOriginalName: input.originalFilename,
      helpImageAltText: altText,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRODUCT_FIELD_ANNOTATION_IMAGE_UPLOADED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT,
      entityId: product.id,
    });

    const urls = await this.resolveImageUrls(updated);
    return toResolvedAnnotation(updated, urls);
  }

  async deleteFieldHelpImage(
    productId: string,
    columnInternalKey: string,
  ): Promise<ProductFieldAnnotationResolved | null> {
    const { profile: admin } = await requireRole("ADMIN");
    const product = await requireProduct(productId);
    await assertColumnKeyInFolder(product.folderId, columnInternalKey);

    const existing = await productFieldAnnotationRepository.findByProductAndKey(
      productId,
      columnInternalKey,
    );

    if (!existing?.helpImagePath) {
      throw new ProductFieldAnnotationError(
        "El campo no tiene imagen de ayuda.",
        "FIELD_HELP_IMAGE_NOT_FOUND",
      );
    }

    await deleteHelpImageFilesBestEffort(existing);

    const helpText = existing.helpText;
    if (!helpText) {
      await productFieldAnnotationRepository.deleteByProductAndKey(
        productId,
        columnInternalKey,
      );

      auditService.logOperationSafe({
        userId: admin.id,
        action: AUDIT_ACTIONS.PRODUCT_FIELD_ANNOTATION_IMAGE_DELETED,
        entityType: AUDIT_ENTITY_TYPES.PRODUCT,
        entityId: product.id,
      });

      return null;
    }

    const updated = await productFieldAnnotationRepository.upsert({
      productId,
      columnInternalKey,
      helpText,
      helpImagePath: null,
      helpImageThumbnailPath: null,
      helpImageMimeType: null,
      helpImageSizeBytes: null,
      helpImageOriginalName: null,
      helpImageAltText: null,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRODUCT_FIELD_ANNOTATION_IMAGE_DELETED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT,
      entityId: product.id,
    });

    return toResolvedAnnotation(updated, { thumbnailUrl: null, fullUrl: null });
  }

  async deleteAllForProductBestEffort(productId: string): Promise<void> {
    const annotations = await productFieldAnnotationRepository.findByProductId(productId);

    for (const annotation of annotations) {
      await deleteHelpImageFilesBestEffort(annotation);
    }

    await productFieldAnnotationRepository.deleteByProductId(productId);
  }
}

export const productFieldAnnotationService = new ProductFieldAnnotationService();
