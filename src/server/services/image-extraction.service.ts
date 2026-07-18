import ExcelJS from "exceljs";
import type { ProductImageStatus } from "@/generated/prisma/client";
import {
  buildEmbeddedImageSummary,
  listEmbeddedImageAnchors,
  sortEmbeddedImageAnchors,
  type EmbeddedImageAnchor,
} from "@/server/importers/excel-image.detector";
import type { DetectedHeader, ParsedSheet } from "@/server/importers/types";
import {
  resolveImageColumnInternalKey,
  type ColumnLabelRef,
} from "@/server/services/product-image-column-map";
import { buildProductImageStoragePaths } from "@/server/image-processors";
import { generateThumbnail, validateImageBuffer } from "@/server/image-processors";
import { productImageRepository } from "@/server/repositories/product-image.repository";
import { uploadFile } from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";

export type EmbeddedImageRef = EmbeddedImageAnchor;

export type ProcessEmbeddedImagesInput = {
  workbook: ExcelJS.Workbook;
  sheet: ParsedSheet;
  folderId: string;
  importJobId: string;
  rowToProductId: Map<number, string>;
  folderColumns?: ColumnLabelRef[];
  /**
   * When true, embedded images on rows without a product mapping are skipped
   * (not sent to PENDING_REVIEW). Used for COMBINAR so existing-row pictures
   * are not re-prompted for ZIP-style linking.
   */
  skipUnmatchedRows?: boolean;
};

export type ProcessedImageRecord = {
  id: string;
  status: ProductImageStatus;
  productId: string | null;
  warning?: string;
};

export type ProcessEmbeddedImagesResult = {
  records: ProcessedImageRecord[];
  warnings: string[];
  stats: {
    extracted: number;
    associated: number;
    pendingReview: number;
    rejected: number;
    ambiguous: number;
    rowsWithEmbeddedImages: number;
    productsWithMultipleEmbeddedImages: number;
    productsWithEmbeddedImages: number;
  };
};

type WorkbookMediaItem = {
  index: number;
  buffer: Buffer;
  extension: string;
};

function getWorkbookMedia(workbook: ExcelJS.Workbook): WorkbookMediaItem[] {
  const model = (workbook as unknown as { model?: { media?: WorkbookMediaItem[] } })
    .model;

  return model?.media ?? [];
}

export function getEmbeddedImageBuffer(
  workbook: ExcelJS.Workbook,
  imageId: number,
): Buffer | null {
  const media = getWorkbookMedia(workbook);
  const byIndex = media.find((entry) => entry.index === imageId);
  if (byIndex?.buffer) {
    return byIndex.buffer;
  }

  const byOffset = media[imageId];
  return byOffset?.buffer ?? null;
}

function extensionToFilename(
  extension: string,
  anchor: EmbeddedImageAnchor,
): string {
  const normalized = extension.replace(/^\./, "").toLowerCase();
  const mapped =
    normalized === "jpeg" || normalized === "jpg"
      ? "jpg"
      : normalized === "png"
        ? "png"
        : normalized === "webp"
          ? "webp"
          : normalized || "png";

  return `embedded-r${anchor.row}-c${anchor.col}-i${anchor.sourceIndex}.${mapped}`;
}

export function listEmbeddedImageRefs(
  workbook: ExcelJS.Workbook,
  sheet: ParsedSheet,
): EmbeddedImageRef[] {
  const worksheet = workbook.getWorksheet(sheet.sheetName);
  if (!worksheet) {
    return [];
  }

  return sortEmbeddedImageAnchors(
    listEmbeddedImageAnchors(worksheet, sheet.headers as DetectedHeader[]),
  );
}

export class ImageExtractionService {
  async processEmbeddedImages(
    input: ProcessEmbeddedImagesInput,
  ): Promise<ProcessEmbeddedImagesResult> {
    const refs = listEmbeddedImageRefs(input.workbook, input.sheet);
    const summary = buildEmbeddedImageSummary(refs);
    const records: ProcessedImageRecord[] = [];
    const warnings: string[] = [];
    const stats = {
      extracted: 0,
      associated: 0,
      pendingReview: 0,
      rejected: 0,
      ambiguous: 0,
      rowsWithEmbeddedImages: summary.rowsWithEmbeddedImages,
      productsWithMultipleEmbeddedImages: summary.productsWithMultipleEmbeddedImages,
      productsWithEmbeddedImages: 0,
    };

    const existingEmbedded = await productImageRepository.findEmbeddedByImportJob(
      input.importJobId,
    );
    const processedOriginalNames = new Set(
      existingEmbedded.map((image) => image.originalName),
    );

    const productSortOrder = new Map<string, number>();
    const productsWithEmbeddedImages = new Set<string>();
    const productsWithPrimary = new Set<string>();

    for (const image of existingEmbedded) {
      if (!image.productId) {
        continue;
      }

      productsWithEmbeddedImages.add(image.productId);
      const nextSortOrder = Math.max(
        productSortOrder.get(image.productId) ?? 0,
        image.sortOrder + 1,
      );
      productSortOrder.set(image.productId, nextSortOrder);

      if (image.isPrimary) {
        productsWithPrimary.add(image.productId);
      }
    }

    const associatedProductIds = Array.from(
      new Set(
        refs
          .map((ref) => input.rowToProductId.get(ref.row))
          .filter((productId): productId is string => Boolean(productId)),
      ),
    );
    const existingPrimaryImages = await productImageRepository.findPrimaryByProductIds(
      associatedProductIds.filter((productId) => !productsWithPrimary.has(productId)),
    );

    for (const image of existingPrimaryImages) {
      if (image.productId) {
        productsWithPrimary.add(image.productId);
      }
    }

    for (const ref of refs) {
      const workbookMedia = getWorkbookMedia(input.workbook);
      const media =
        workbookMedia.find((entry) => entry.index === ref.imageId) ??
        workbookMedia[ref.imageId];
      const originalName = extensionToFilename(media?.extension ?? ".png", ref);

      if (processedOriginalNames.has(originalName)) {
        continue;
      }

      const productIdForRow = input.rowToProductId.get(ref.row) ?? null;
      if (!productIdForRow && input.skipUnmatchedRows) {
        // COMBINAR: ignore embedded images on rows that already existed in the folder.
        continue;
      }

      stats.extracted += 1;

      const buffer = getEmbeddedImageBuffer(input.workbook, ref.imageId);
      if (!buffer) {
        stats.rejected += 1;
        const created = await productImageRepository.create({
          importJobId: input.importJobId,
          originalName: extensionToFilename(".png", ref),
          mimeType: "application/octet-stream",
          status: "FORMAT_REJECTED",
          source: "EMBEDDED",
          sourceSheet: ref.sheetName,
          sourceRow: ref.row,
          sourceColumn: ref.columnHeader,
          label: ref.columnHeader,
          errorMessage: "No se pudo leer el binario de la imagen embebida.",
        });
        records.push({
          id: created.id,
          status: created.status,
          productId: null,
          warning: created.errorMessage ?? undefined,
        });
        warnings.push(
          `Fila ${ref.row}: no se pudo extraer la imagen embebida (${ref.placementKey}).`,
        );
        continue;
      }

      const validation = await validateImageBuffer(buffer);

      if (!validation.valid) {
        stats.rejected += 1;
        const created = await productImageRepository.create({
          importJobId: input.importJobId,
          originalName,
          mimeType: "application/octet-stream",
          sizeBytes: buffer.byteLength,
          status: "FORMAT_REJECTED",
          source: "EMBEDDED",
          sourceSheet: ref.sheetName,
          sourceRow: ref.row,
          sourceColumn: ref.columnHeader,
          label: ref.columnHeader,
          errorMessage: validation.error,
        });
        records.push({
          id: created.id,
          status: created.status,
          productId: null,
          warning: validation.error,
        });
        warnings.push(`Fila ${ref.row}: ${validation.error}`);
        continue;
      }

      const productId = productIdForRow;
      let status: ProductImageStatus = "PENDING_REVIEW";

      if (productId) {
        status = "ASSOCIATED_AUTO";
        stats.associated += 1;
        productsWithEmbeddedImages.add(productId);
      } else {
        stats.pendingReview += 1;
      }

      let storagePath: string | null = null;
      let thumbnailPath: string | null = null;
      let sortOrder = 0;
      let isPrimary = false;

      if (productId) {
        const nextSortOrder = productSortOrder.get(productId) ?? 0;
        sortOrder = nextSortOrder;
        productSortOrder.set(productId, nextSortOrder + 1);
        isPrimary = !productsWithPrimary.has(productId);
        if (isPrimary) {
          productsWithPrimary.add(productId);
        }

        const imageId = crypto.randomUUID();
        const paths = buildProductImageStoragePaths(
          input.folderId,
          productId,
          imageId,
          originalName,
        );
        const { thumbnailBuffer } = await generateThumbnail(buffer);

        await uploadFile({
          bucket: STORAGE_BUCKETS.PRODUCT_IMAGES,
          path: paths.storagePath,
          body: buffer,
          contentType: validation.mimeType,
          originalFilename: originalName,
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
        const stagingId = crypto.randomUUID();
        const stagingPath = `imports/${input.importJobId}/external/${stagingId}-${originalName.replace(/[/\\]/g, "_")}`;

        await uploadFile({
          bucket: STORAGE_BUCKETS.TEMP_IMPORTS,
          path: stagingPath,
          body: buffer,
          contentType: validation.mimeType,
          originalFilename: originalName,
        });

        storagePath = stagingPath;
      }

      const created = await productImageRepository.create({
        productId,
        importJobId: input.importJobId,
        storagePath,
        thumbnailPath,
        originalName,
        mimeType: validation.mimeType,
        sizeBytes: buffer.byteLength,
        sortOrder,
        isPrimary,
        label:
          input.folderColumns && ref.columnHeader
            ? resolveImageColumnInternalKey(
                { label: null, sourceColumn: ref.columnHeader },
                input.folderColumns,
              ) ?? ref.columnHeader
            : ref.columnHeader,
        sourceSheet: ref.sheetName,
        sourceRow: ref.row,
        sourceColumn: ref.columnHeader,
        status,
        source: "EMBEDDED",
      });

      records.push({ id: created.id, status: created.status, productId });
    }

    stats.productsWithEmbeddedImages = productsWithEmbeddedImages.size;

    return { records, warnings, stats };
  }
}

export const imageExtractionService = new ImageExtractionService();
