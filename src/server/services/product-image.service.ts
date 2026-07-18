import type {
  ProductImage,
  ProductImageSource,
  ProductImageStatus,
} from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { LINKED_EXTRA_IMAGE_LABEL } from "@/features/catalog/utils/linked-extra-image";
import type { ExternalImageRef } from "@/server/importers/types";
import { requireAuth, requireAdmin, requireEditor } from "@/server/auth";
import {
  buildImportExternalImagePath,
  buildProductImageStoragePaths,
  generateThumbnail,
  validateImageBuffer,
} from "@/server/image-processors";
import { folderRepository } from "@/server/repositories/folder.repository";
import { productRepository } from "@/server/repositories/product.repository";
import {
  productImageRepository,
  type ProductImageListOptions,
} from "@/server/repositories/product-image.repository";
import {
  buildProductMatchIndex,
  imageMatchingService,
  isAllowedImageExtension,
  type ExternalImageInput,
  type ProductForMatching,
} from "@/server/services/image-matching.service";
import {
  createSignedDownloadUrl,
  deleteFile,
  downloadFile,
  uploadFile,
} from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";
import { BUCKET_CONFIGS } from "@/server/storage/config";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { ProductImageError } from "./product-image.errors";
import { VisibilityError } from "./visibility.errors";
import { visibilityService } from "./visibility.service";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import {
  resolveImageColumnInternalKey,
  type ColumnLabelRef,
} from "./product-image-column-map";

export type ProductImageUrls = {
  id: string;
  thumbnailUrl: string | null;
  fullUrl: string | null;
};

export type ProductImageReviewItem = {
  id: string;
  productId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  isPrimary: boolean;
  label: string | null;
  sourceSheet: string | null;
  sourceRow: number | null;
  sourceColumn: string | null;
  status: ProductImageStatus;
  source: ProductImageSource;
  matchCandidates: unknown;
  errorMessage: string | null;
  thumbnailUrl: string | null;
  fullUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProcessExternalImagesInput = {
  importJobId: string;
  folderId: string;
  images: ExternalImageInput[];
  imageCodeColumnKeys: string[];
  includePrimaryCodeInMatch?: boolean;
};

export type ProcessExternalImagesResult = {
  warnings: string[];
  stats: {
    processed: number;
    associated: number;
    pendingReview: number;
    rejected: number;
    ambiguous: number;
    duplicateName: number;
  };
};

async function resolveImageUrls(
  image: ProductImage,
  options?: { includeFullUrls?: boolean },
): Promise<{ thumbnailUrl: string | null; fullUrl: string | null }> {
  const includeFullUrls = options?.includeFullUrls !== false;
  let thumbnailUrl: string | null = null;
  let fullUrl: string | null = null;

  try {
    const isStaging = image.storagePath?.startsWith("imports/") ?? false;
    const bucket = isStaging
      ? STORAGE_BUCKETS.TEMP_IMPORTS
      : STORAGE_BUCKETS.PRODUCT_IMAGES;

    if (image.thumbnailPath) {
      const thumb = await createSignedDownloadUrl(
        STORAGE_BUCKETS.PRODUCT_IMAGES,
        image.thumbnailPath,
      );
      thumbnailUrl = thumb.signedUrl;
    } else if (image.storagePath && isStaging) {
      const full = await createSignedDownloadUrl(bucket, image.storagePath);
      thumbnailUrl = full.signedUrl;
    }

    if (includeFullUrls && image.storagePath) {
      const full = await createSignedDownloadUrl(bucket, image.storagePath);
      fullUrl = full.signedUrl;
    }
  } catch {
    return { thumbnailUrl: null, fullUrl: null };
  }

  return { thumbnailUrl, fullUrl };
}

async function persistMatchedImage(input: {
  importJobId: string;
  folderId: string;
  productId: string | null;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  source: ProductImageSource;
  status: ProductImageStatus;
  matchCandidates?: unknown;
  sortOrder?: number;
  isPrimary?: boolean;
}): Promise<ProductImage> {
  const imageId = crypto.randomUUID();
  let storagePath: string | null = null;
  let thumbnailPath: string | null = null;

  if (input.productId) {
    const paths = buildProductImageStoragePaths(
      input.folderId,
      input.productId,
      imageId,
      input.originalName,
    );
    const { thumbnailBuffer } = await generateThumbnail(input.buffer);

    await uploadFile({
      bucket: STORAGE_BUCKETS.PRODUCT_IMAGES,
      path: paths.storagePath,
      body: input.buffer,
      contentType: input.mimeType,
      originalFilename: input.originalName,
    });
    await uploadFile({
      bucket: STORAGE_BUCKETS.PRODUCT_IMAGES,
      path: paths.thumbnailPath,
      body: thumbnailBuffer,
      contentType: "image/webp",
      originalFilename: `${imageId}-thumb.webp`,
    });

    storagePath = paths.storagePath;
    thumbnailPath = paths.thumbnailPath;
  } else {
    const stagingPath = buildImportExternalImagePath(
      input.importJobId,
      imageId,
      input.originalName,
    );

    await uploadFile({
      bucket: STORAGE_BUCKETS.TEMP_IMPORTS,
      path: stagingPath,
      body: input.buffer,
      contentType: input.mimeType,
      originalFilename: input.originalName,
    });

    storagePath = stagingPath;
  }

  return productImageRepository.create({
    productId: input.productId,
    importJobId: input.importJobId,
    storagePath,
    thumbnailPath,
    originalName: input.originalName,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.byteLength,
    sortOrder: input.sortOrder ?? 0,
    isPrimary: input.isPrimary ?? false,
    status: input.status,
    source: input.source,
    matchCandidates: input.matchCandidates as never,
  });
}

export class ProductImageService {
  async uploadExternalToStaging(input: {
    jobId: string;
    buffer: Buffer;
    originalFilename: string;
    contentType: string;
    source: ExternalImageRef["source"];
  }): Promise<ExternalImageRef> {
    await requireAdmin();

    if (!isAllowedImageExtension(input.originalFilename)) {
      throw new ProductImageError(
        "Extensión de imagen no permitida.",
        "VALIDATION_ERROR",
      );
    }

    const validation = await validateImageBuffer(input.buffer);
    if (!validation.valid) {
      throw new ProductImageError(
        validation.error,
        "VALIDATION_ERROR",
      );
    }

    const path = buildImportExternalImagePath(
      input.jobId,
      crypto.randomUUID(),
      input.originalFilename,
    );

    const uploaded = await uploadFile({
      bucket: STORAGE_BUCKETS.TEMP_IMPORTS,
      path,
      body: input.buffer,
      contentType: validation.mimeType,
      originalFilename: input.originalFilename,
    });

    return {
      storagePath: uploaded.path,
      originalName: input.originalFilename,
      mimeType: uploaded.contentType,
      sizeBytes: uploaded.sizeBytes,
      source: input.source,
    };
  }

  async processExternalImages(
    input: ProcessExternalImagesInput,
  ): Promise<ProcessExternalImagesResult> {
    const products = await productRepository.findForMatchingByFolder(input.folderId);

    const fullProducts: ProductForMatching[] = products.map((product) => ({
      id: product.id,
      primaryCode: product.primaryCode,
      normalizedCode: product.normalizedCode,
      dynamicData:
        typeof product.dynamicData === "object" &&
        product.dynamicData !== null &&
        !Array.isArray(product.dynamicData)
          ? (product.dynamicData as Record<string, unknown>)
          : {},
    }));

    const index = buildProductMatchIndex(fullProducts, input.imageCodeColumnKeys, {
      includePrimaryCode: input.includePrimaryCodeInMatch ?? true,
    });
    const seenNames = new Map<string, number>();
    const warnings: string[] = [];
    const stats = {
      processed: 0,
      associated: 0,
      pendingReview: 0,
      rejected: 0,
      ambiguous: 0,
      duplicateName: 0,
    };

    const productImageCounts = new Map<string, number>();

    for (const image of input.images) {
      stats.processed += 1;

      if (!isAllowedImageExtension(image.originalName)) {
        stats.rejected += 1;
        await productImageRepository.create({
          importJobId: input.importJobId,
          originalName: image.originalName,
          mimeType: image.mimeType ?? "application/octet-stream",
          status: "FORMAT_REJECTED",
          source: image.source,
          errorMessage: "Extensión no permitida.",
        });
        warnings.push(`${image.originalName}: extensión no permitida.`);
        continue;
      }

      const validation = await validateImageBuffer(image.buffer);
      if (!validation.valid) {
        stats.rejected += 1;
        await productImageRepository.create({
          importJobId: input.importJobId,
          originalName: image.originalName,
          mimeType: "application/octet-stream",
          sizeBytes: image.buffer.byteLength,
          status: "FORMAT_REJECTED",
          source: image.source,
          errorMessage: validation.error,
        });
        warnings.push(`${image.originalName}: ${validation.error}`);
        continue;
      }

      const outcome = imageMatchingService.matchExternalImage(
        image,
        index,
        seenNames,
      );

      if (outcome.status === "DUPLICATE_NAME") {
        stats.duplicateName += 1;
        await productImageRepository.create({
          importJobId: input.importJobId,
          originalName: image.originalName,
          mimeType: validation.mimeType,
          sizeBytes: image.buffer.byteLength,
          status: "DUPLICATE_NAME",
          source: image.source,
          errorMessage: "Nombre de archivo duplicado en el lote.",
        });
        warnings.push(`${image.originalName}: nombre duplicado.`);
        continue;
      }

      if (outcome.status === "AMBIGUOUS") {
        stats.ambiguous += 1;
        await persistMatchedImage({
          importJobId: input.importJobId,
          folderId: input.folderId,
          productId: null,
          buffer: image.buffer,
          originalName: image.originalName,
          mimeType: validation.mimeType,
          source: image.source,
          status: "AMBIGUOUS",
          matchCandidates: outcome.candidates,
        });
        continue;
      }

      if (outcome.status === "PENDING_REVIEW") {
        stats.pendingReview += 1;
        await persistMatchedImage({
          importJobId: input.importJobId,
          folderId: input.folderId,
          productId: null,
          buffer: image.buffer,
          originalName: image.originalName,
          mimeType: validation.mimeType,
          source: image.source,
          status: "PENDING_REVIEW",
        });
        continue;
      }

      const productId = outcome.productId;
      const count = (productImageCounts.get(productId) ?? 0) + 1;
      productImageCounts.set(productId, count);
      stats.associated += 1;

      await persistMatchedImage({
        importJobId: input.importJobId,
        folderId: input.folderId,
        productId,
        buffer: image.buffer,
        originalName: image.originalName,
        mimeType: validation.mimeType,
        source: image.source,
        status: "ASSOCIATED_AUTO",
        sortOrder: count - 1,
        isPrimary: count === 1,
      });
    }

    return { warnings, stats };
  }

  async listImportReview(
    importJobId: string,
    options: Omit<ProductImageListOptions, "page" | "pageSize"> & {
      page?: number;
      pageSize?: number;
      status?: ProductImageStatus | ProductImageStatus[];
    },
  ): Promise<{
    items: ProductImageReviewItem[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    await requireAdmin();

    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 50;
    const { items, total } = await productImageRepository.findByImportJob(
      importJobId,
      { page, pageSize, status: options.status },
    );

    const mapped = await Promise.all(
      items.map(async (image) => {
        const urls = await resolveImageUrls(image);
        return {
          id: image.id,
          productId: image.productId,
          originalName: image.originalName,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          sortOrder: image.sortOrder,
          isPrimary: image.isPrimary,
          label: image.label,
          sourceSheet: image.sourceSheet,
          sourceRow: image.sourceRow,
          sourceColumn: image.sourceColumn,
          status: image.status,
          source: image.source,
          matchCandidates: image.matchCandidates,
          errorMessage: image.errorMessage,
          thumbnailUrl: urls.thumbnailUrl,
          fullUrl: urls.fullUrl,
          createdAt: image.createdAt.toISOString(),
          updatedAt: image.updatedAt.toISOString(),
        };
      }),
    );

    return {
      items: mapped,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  async associateWithProduct(input: {
    importJobId: string;
    imageId: string;
    productId: string;
    folderId: string;
  }): Promise<ProductImageReviewItem> {
    const { profile: admin } = await requireAdmin();

    const image = await productImageRepository.findByIdAndJob(
      input.imageId,
      input.importJobId,
    );

    if (!image) {
      throw new ProductImageError("Imagen no encontrada.", "IMAGE_NOT_FOUND");
    }

    const product = await productRepository.findById(input.productId);
    if (!product || product.folderId !== input.folderId) {
      throw new ProductImageError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
    }

    let storagePath = image.storagePath;
    let thumbnailPath = image.thumbnailPath;

    if (!storagePath) {
      throw new ProductImageError(
        "La imagen no tiene archivo almacenado.",
        "VALIDATION_ERROR",
      );
    }

    const isStaging = storagePath.startsWith("imports/");
    const buffer = await downloadFile(
      isStaging ? STORAGE_BUCKETS.TEMP_IMPORTS : STORAGE_BUCKETS.PRODUCT_IMAGES,
      storagePath,
    );
    const imageUuid = crypto.randomUUID();
    const paths = buildProductImageStoragePaths(
      input.folderId,
      input.productId,
      imageUuid,
      image.originalName,
    );
    const { thumbnailBuffer } = await generateThumbnail(buffer);

    await uploadFile({
      bucket: STORAGE_BUCKETS.PRODUCT_IMAGES,
      path: paths.storagePath,
      body: buffer,
      contentType: image.mimeType,
      originalFilename: image.originalName,
    });
    await uploadFile({
      bucket: STORAGE_BUCKETS.PRODUCT_IMAGES,
      path: paths.thumbnailPath,
      body: thumbnailBuffer,
      contentType: "image/webp",
      originalFilename: `${imageUuid}-thumb.webp`,
    });

    if (!isStaging) {
      try {
        await deleteFile(STORAGE_BUCKETS.PRODUCT_IMAGES, storagePath);
        if (thumbnailPath) {
          await deleteFile(STORAGE_BUCKETS.PRODUCT_IMAGES, thumbnailPath);
        }
      } catch {
        // best effort
      }
    } else {
      try {
        await deleteFile(STORAGE_BUCKETS.TEMP_IMPORTS, storagePath);
      } catch {
        // best effort
      }
    }

    storagePath = paths.storagePath;
    thumbnailPath = paths.thumbnailPath;

    const updated = await productImageRepository.update(image.id, {
      product: { connect: { id: input.productId } },
      storagePath,
      thumbnailPath,
      status: "ASSOCIATED_MANUAL",
      matchCandidates: Prisma.JsonNull,
      errorMessage: null,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRODUCT_IMAGE_ASSOCIATED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT_IMAGE,
      entityId: image.id,
    });

    const urls = await resolveImageUrls(updated);
    return {
      id: updated.id,
      productId: updated.productId,
      originalName: updated.originalName,
      mimeType: updated.mimeType,
      sizeBytes: updated.sizeBytes,
      sortOrder: updated.sortOrder,
      isPrimary: updated.isPrimary,
      label: updated.label,
      sourceSheet: updated.sourceSheet,
      sourceRow: updated.sourceRow,
      sourceColumn: updated.sourceColumn,
      status: updated.status,
      source: updated.source,
      matchCandidates: updated.matchCandidates,
      errorMessage: updated.errorMessage,
      thumbnailUrl: urls.thumbnailUrl,
      fullUrl: urls.fullUrl,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async updateImage(input: {
    importJobId: string;
    imageId: string;
    isPrimary?: boolean;
    sortOrder?: number;
    label?: string | null;
  }): Promise<ProductImageReviewItem> {
    const { profile: admin } = await requireAdmin();

    const image = await productImageRepository.findByIdAndJob(
      input.imageId,
      input.importJobId,
    );

    if (!image) {
      throw new ProductImageError("Imagen no encontrada.", "IMAGE_NOT_FOUND");
    }

    if (input.isPrimary && image.productId) {
      await productImageRepository.clearPrimaryForProduct(image.productId);
    }

    const updated = await productImageRepository.update(image.id, {
      ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRODUCT_IMAGE_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT_IMAGE,
      entityId: image.id,
    });

    const urls = await resolveImageUrls(updated);
    return {
      id: updated.id,
      productId: updated.productId,
      originalName: updated.originalName,
      mimeType: updated.mimeType,
      sizeBytes: updated.sizeBytes,
      sortOrder: updated.sortOrder,
      isPrimary: updated.isPrimary,
      label: updated.label,
      sourceSheet: updated.sourceSheet,
      sourceRow: updated.sourceRow,
      sourceColumn: updated.sourceColumn,
      status: updated.status,
      source: updated.source,
      matchCandidates: updated.matchCandidates,
      errorMessage: updated.errorMessage,
      thumbnailUrl: urls.thumbnailUrl,
      fullUrl: urls.fullUrl,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async softDeleteImage(importJobId: string, imageId: string): Promise<void> {
    const { profile: admin } = await requireAdmin();

    const image = await productImageRepository.findByIdAndJob(imageId, importJobId);
    if (!image) {
      throw new ProductImageError("Imagen no encontrada.", "IMAGE_NOT_FOUND");
    }

    await productImageRepository.update(image.id, { status: "DELETED" });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRODUCT_IMAGE_DELETED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT_IMAGE,
      entityId: image.id,
    });
  }

  async getProductImageSignedUrl(
    productId: string,
    imageId: string,
    size: "full" | "thumb" = "full",
  ): Promise<{ url: string | null }> {
    const { profile } = await requireAuth();

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new ProductImageError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
    }

    const folder = await folderRepository.findById(product.folderId);
    if (!folder) {
      throw new ProductImageError("Carpeta no encontrada.", "PRODUCT_NOT_FOUND");
    }

    const catalog = await catalogRepository.findById(folder.catalogId);
    if (!catalog) {
      throw new ProductImageError("Catálogo no encontrado.", "PRODUCT_NOT_FOUND");
    }

    try {
      visibilityService.assertCatalogVisibleForRole(catalog, profile.role);
      visibilityService.assertFolderVisibleForRole(folder, profile.role);
    } catch (error) {
      if (error instanceof VisibilityError) {
        throw new ProductImageError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
      }
      throw error;
    }

    const image = await productImageRepository.findById(imageId);
    if (!image || image.productId !== productId) {
      throw new ProductImageError("Imagen no encontrada.", "IMAGE_NOT_FOUND");
    }

    const urls = await resolveImageUrls(image, { includeFullUrls: true });
    const url =
      size === "full"
        ? (urls.fullUrl ?? urls.thumbnailUrl)
        : (urls.thumbnailUrl ?? urls.fullUrl);

    return { url };
  }

  async getProductImages(productId: string): Promise<ProductImageReviewItem[]> {
    const { profile } = await requireAuth();

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new ProductImageError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
    }

    const folder = await folderRepository.findById(product.folderId);
    if (!folder) {
      throw new ProductImageError("Carpeta no encontrada.", "PRODUCT_NOT_FOUND");
    }

    const catalog = await catalogRepository.findById(folder.catalogId);
    if (!catalog) {
      throw new ProductImageError("Catálogo no encontrado.", "PRODUCT_NOT_FOUND");
    }

    try {
      visibilityService.assertCatalogVisibleForRole(catalog, profile.role);
      visibilityService.assertFolderVisibleForRole(folder, profile.role);
    } catch (error) {
      if (error instanceof VisibilityError) {
        throw new ProductImageError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
      }
      throw error;
    }

    const images = await productImageRepository.findByProduct(productId);

    return Promise.all(
      images.map(async (image) => {
        const urls = await resolveImageUrls(image);
        return {
          id: image.id,
          productId: image.productId,
          originalName: image.originalName,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          sortOrder: image.sortOrder,
          isPrimary: image.isPrimary,
          label: image.label,
          sourceSheet: image.sourceSheet,
          sourceRow: image.sourceRow,
          sourceColumn: image.sourceColumn,
          status: image.status,
          source: image.source,
          matchCandidates: image.matchCandidates,
          errorMessage: image.errorMessage,
          thumbnailUrl: urls.thumbnailUrl,
          fullUrl: urls.fullUrl,
          createdAt: image.createdAt.toISOString(),
          updatedAt: image.updatedAt.toISOString(),
        };
      }),
    );
  }

  async resolvePrimaryImagesForProducts(
    productIds: string[],
    options?: { includeFullUrls?: boolean },
  ): Promise<Map<string, ProductImageUrls>> {
    const images = await productImageRepository.findPrimaryByProductIds(productIds);
    const result = new Map<string, ProductImageUrls>();

    await Promise.all(
      images.map(async (image) => {
        if (!image.productId) {
          return;
        }

        const urls = await resolveImageUrls(image, options);
        result.set(image.productId, {
          id: image.id,
          thumbnailUrl: urls.thumbnailUrl,
          fullUrl: urls.fullUrl,
        });
      }),
    );

    return result;
  }

  async resolveExtraImagesForProducts(
    productIds: string[],
    options?: { includeFullUrls?: boolean },
  ): Promise<Map<string, ProductImageUrls[]>> {
    const images = await productImageRepository.findAssociatedByProductIds(productIds);
    const result = new Map<string, ProductImageUrls[]>();

    await Promise.all(
      images.map(async (image) => {
        if (!image.productId || image.isPrimary) {
          return;
        }

        if (image.label !== LINKED_EXTRA_IMAGE_LABEL) {
          return;
        }

        const urls = await resolveImageUrls(image, options);
        const bucket = result.get(image.productId) ?? [];
        bucket.push({
          id: image.id,
          thumbnailUrl: urls.thumbnailUrl,
          fullUrl: urls.fullUrl,
        });
        result.set(image.productId, bucket);
      }),
    );

    return result;
  }

  async resolveColumnImagesForProducts(
    productIds: string[],
    columns: ColumnLabelRef[],
    options?: { includeFullUrls?: boolean },
  ): Promise<Map<string, Record<string, ProductImageUrls[]>>> {
    const images = await productImageRepository.findAssociatedByProductIds(productIds);
    const result = new Map<string, Record<string, ProductImageUrls[]>>();

    await Promise.all(
      images.map(async (image) => {
        if (!image.productId) {
          return;
        }

        const columnKey = resolveImageColumnInternalKey(image, columns);
        if (!columnKey) {
          return;
        }

        const urls = await resolveImageUrls(image, options);
        const entry = result.get(image.productId) ?? {};
        const bucket = entry[columnKey] ?? [];
        bucket.push({
          id: image.id,
          thumbnailUrl: urls.thumbnailUrl,
          fullUrl: urls.fullUrl,
        });
        entry[columnKey] = bucket;
        result.set(image.productId, entry);
      }),
    );

    return result;
  }

  private async assertProductForEditor(productId: string) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new ProductImageError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
    }

    await requireEditor();
    return product;
  }

  private async mapReviewItem(image: ProductImage): Promise<ProductImageReviewItem> {
    const urls = await resolveImageUrls(image);
    return {
      id: image.id,
      productId: image.productId,
      originalName: image.originalName,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
      label: image.label,
      sourceSheet: image.sourceSheet,
      sourceRow: image.sourceRow,
      sourceColumn: image.sourceColumn,
      status: image.status,
      source: image.source,
      matchCandidates: image.matchCandidates,
      errorMessage: image.errorMessage,
      thumbnailUrl: urls.thumbnailUrl,
      fullUrl: urls.fullUrl,
      createdAt: image.createdAt.toISOString(),
      updatedAt: image.updatedAt.toISOString(),
    };
  }

  private async persistManualImage(input: {
    productId: string;
    folderId: string;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    isPrimary?: boolean;
    sortOrder?: number;
    label?: string | null;
  }): Promise<ProductImage> {
    if (input.isPrimary) {
      await productImageRepository.clearPrimaryForProduct(input.productId);
    }

    const imageId = crypto.randomUUID();
    const paths = buildProductImageStoragePaths(
      input.folderId,
      input.productId,
      imageId,
      input.originalName,
    );
    const { thumbnailBuffer } = await generateThumbnail(input.buffer);

    await uploadFile({
      bucket: STORAGE_BUCKETS.PRODUCT_IMAGES,
      path: paths.storagePath,
      body: input.buffer,
      contentType: input.mimeType,
      originalFilename: input.originalName,
    });
    await uploadFile({
      bucket: STORAGE_BUCKETS.PRODUCT_IMAGES,
      path: paths.thumbnailPath,
      body: thumbnailBuffer,
      contentType: "image/webp",
      originalFilename: `${imageId}-thumb.webp`,
    });

    return productImageRepository.create({
      productId: input.productId,
      storagePath: paths.storagePath,
      thumbnailPath: paths.thumbnailPath,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.byteLength,
      sortOrder: input.sortOrder ?? 0,
      isPrimary: input.isPrimary ?? false,
      label: input.label ?? null,
      status: "ASSOCIATED_MANUAL",
      source: "MANUAL",
    });
  }

  async uploadManualImage(input: {
    productId: string;
    buffer: Buffer;
    originalFilename: string;
    isPrimary?: boolean;
    sortOrder?: number;
    label?: string | null;
  }): Promise<ProductImageReviewItem> {
    const { profile: editor } = await requireEditor();
    const product = await this.assertProductForEditor(input.productId);

    const maxSize = BUCKET_CONFIGS[STORAGE_BUCKETS.PRODUCT_IMAGES].maxSizeBytes;
    if (input.buffer.byteLength > maxSize) {
      throw new ProductImageError("La imagen supera el tamaño máximo permitido.", "VALIDATION_ERROR");
    }

    const validation = await validateImageBuffer(input.buffer);
    if (!validation.valid) {
      throw new ProductImageError(
        validation.error,
        "VALIDATION_ERROR",
      );
    }

    const image = await this.persistManualImage({
      productId: product.id,
      folderId: product.folderId,
      buffer: input.buffer,
      originalName: input.originalFilename,
      mimeType: validation.mimeType,
      isPrimary: input.isPrimary,
      sortOrder: input.sortOrder,
      label: input.label,
    });

    auditService.logOperationSafe({
      userId: editor.id,
      action: AUDIT_ACTIONS.PRODUCT_IMAGE_ASSOCIATED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT_IMAGE,
      entityId: image.id,
    });

    return this.mapReviewItem(image);
  }

  async replaceManualImage(input: {
    productId: string;
    imageId: string;
    buffer: Buffer;
    originalFilename: string;
  }): Promise<ProductImageReviewItem> {
    const { profile: editor } = await requireEditor();
    const product = await this.assertProductForEditor(input.productId);

    const image = await productImageRepository.findById(input.imageId);
    if (!image || image.productId !== product.id || image.status === "DELETED") {
      throw new ProductImageError("Imagen no encontrada.", "IMAGE_NOT_FOUND");
    }

    const maxSize = BUCKET_CONFIGS[STORAGE_BUCKETS.PRODUCT_IMAGES].maxSizeBytes;
    if (input.buffer.byteLength > maxSize) {
      throw new ProductImageError("La imagen supera el tamaño máximo permitido.", "VALIDATION_ERROR");
    }

    const validation = await validateImageBuffer(input.buffer);
    if (!validation.valid) {
      throw new ProductImageError(
        validation.error,
        "VALIDATION_ERROR",
      );
    }

    const oldStoragePath = image.storagePath;
    const oldThumbnailPath = image.thumbnailPath;
    const imageUuid = crypto.randomUUID();
    const paths = buildProductImageStoragePaths(
      product.folderId,
      product.id,
      imageUuid,
      input.originalFilename,
    );
    const { thumbnailBuffer } = await generateThumbnail(input.buffer);

    await uploadFile({
      bucket: STORAGE_BUCKETS.PRODUCT_IMAGES,
      path: paths.storagePath,
      body: input.buffer,
      contentType: validation.mimeType,
      originalFilename: input.originalFilename,
    });
    await uploadFile({
      bucket: STORAGE_BUCKETS.PRODUCT_IMAGES,
      path: paths.thumbnailPath,
      body: thumbnailBuffer,
      contentType: "image/webp",
      originalFilename: `${imageUuid}-thumb.webp`,
    });

    const updated = await productImageRepository.update(image.id, {
      storagePath: paths.storagePath,
      thumbnailPath: paths.thumbnailPath,
      originalName: input.originalFilename,
      mimeType: validation.mimeType,
      sizeBytes: input.buffer.byteLength,
      status: "ASSOCIATED_MANUAL",
      source: "MANUAL",
    });

    if (oldStoragePath) {
      try {
        await deleteFile(STORAGE_BUCKETS.PRODUCT_IMAGES, oldStoragePath);
      } catch {
        // best effort
      }
    }
    if (oldThumbnailPath) {
      try {
        await deleteFile(STORAGE_BUCKETS.PRODUCT_IMAGES, oldThumbnailPath);
      } catch {
        // best effort
      }
    }

    auditService.logOperationSafe({
      userId: editor.id,
      action: AUDIT_ACTIONS.PRODUCT_IMAGE_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT_IMAGE,
      entityId: updated.id,
    });

    return this.mapReviewItem(updated);
  }

  async updateProductImage(input: {
    productId: string;
    imageId: string;
    isPrimary?: boolean;
    sortOrder?: number;
    label?: string | null;
  }): Promise<ProductImageReviewItem> {
    const { profile: editor } = await requireEditor();
    await this.assertProductForEditor(input.productId);

    const image = await productImageRepository.findById(input.imageId);
    if (!image || image.productId !== input.productId || image.status === "DELETED") {
      throw new ProductImageError("Imagen no encontrada.", "IMAGE_NOT_FOUND");
    }

    if (input.isPrimary) {
      await productImageRepository.clearPrimaryForProduct(input.productId);
    }

    const updated = await productImageRepository.update(image.id, {
      ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
    });

    auditService.logOperationSafe({
      userId: editor.id,
      action: AUDIT_ACTIONS.PRODUCT_IMAGE_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT_IMAGE,
      entityId: updated.id,
    });

    return this.mapReviewItem(updated);
  }

  async deleteProductImage(productId: string, imageId: string): Promise<void> {
    const { profile: editor } = await requireEditor();
    await this.assertProductForEditor(productId);

    const image = await productImageRepository.findById(imageId);
    if (!image || image.productId !== productId || image.status === "DELETED") {
      throw new ProductImageError("Imagen no encontrada.", "IMAGE_NOT_FOUND");
    }

    await productImageRepository.update(image.id, { status: "DELETED" });

    auditService.logOperationSafe({
      userId: editor.id,
      action: AUDIT_ACTIONS.PRODUCT_IMAGE_DELETED,
      entityType: AUDIT_ENTITY_TYPES.PRODUCT_IMAGE,
      entityId: image.id,
    });
  }

  async duplicateImagesForProduct(
    sourceProductId: string,
    targetProductId: string,
    folderId: string,
  ): Promise<void> {
    const images = await productImageRepository.findByProduct(sourceProductId);

    for (const image of images) {
      if (!image.storagePath) {
        continue;
      }

      const buffer = await downloadFile(
        STORAGE_BUCKETS.PRODUCT_IMAGES,
        image.storagePath,
      );

      await this.persistManualImage({
        productId: targetProductId,
        folderId,
        buffer,
        originalName: image.originalName,
        mimeType: image.mimeType,
        isPrimary: image.isPrimary,
        sortOrder: image.sortOrder,
        label: image.label,
      });
    }
  }
}

export const productImageService = new ProductImageService();
