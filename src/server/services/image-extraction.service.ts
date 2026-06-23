import ExcelJS from "exceljs";
import type { ProductImageStatus } from "@/generated/prisma/client";
import type { DetectedHeader, ParsedSheet } from "@/server/importers/types";
import { buildProductImageStoragePaths } from "@/server/image-processors";
import { generateThumbnail, validateImageBuffer } from "@/server/image-processors";
import { productImageRepository } from "@/server/repositories/product-image.repository";
import { uploadFile } from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";

export type EmbeddedImageRef = {
  imageId: number;
  sheetName: string;
  row: number;
  col: number;
  columnHeader: string | null;
};

export type ProcessEmbeddedImagesInput = {
  workbook: ExcelJS.Workbook;
  sheet: ParsedSheet;
  folderId: string;
  importJobId: string;
  rowToProductId: Map<number, string>;
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
  };
};

type WorkbookMediaItem = {
  index: number;
  buffer: Buffer;
  extension: string;
};

function resolveColumnHeader(
  headers: DetectedHeader[],
  colIndex: number,
): string | null {
  const header = headers.find((item) => item.columnIndex === colIndex);
  return header?.originalName ?? null;
}

export function listEmbeddedImageRefs(
  workbook: ExcelJS.Workbook,
  sheet: ParsedSheet,
): EmbeddedImageRef[] {
  const worksheet = workbook.getWorksheet(sheet.sheetName);
  if (!worksheet?.getImages) {
    return [];
  }

  const refs: EmbeddedImageRef[] = [];

  for (const image of worksheet.getImages()) {
    const row =
      typeof image.range?.tl?.nativeRow === "number"
        ? image.range.tl.nativeRow + 1
        : typeof image.range?.tl?.row === "number"
          ? image.range.tl.row
          : 0;

    const col =
      typeof image.range?.tl?.nativeCol === "number"
        ? image.range.tl.nativeCol
        : typeof image.range?.tl?.col === "number"
          ? image.range.tl.col
          : 0;

    const imageId = Number(image.imageId);
    if (Number.isNaN(imageId)) {
      continue;
    }

    refs.push({
      imageId,
      sheetName: sheet.sheetName,
      row,
      col,
      columnHeader: resolveColumnHeader(sheet.headers, col),
    });
  }

  return refs;
}

function getWorkbookMedia(workbook: ExcelJS.Workbook): WorkbookMediaItem[] {
  const model = (workbook as unknown as { model?: { media?: WorkbookMediaItem[] } })
    .model;

  return model?.media ?? [];
}

function getEmbeddedImageBuffer(
  workbook: ExcelJS.Workbook,
  imageId: number,
): Buffer | null {
  const media = getWorkbookMedia(workbook);
  const item = media.find((entry) => entry.index === imageId);
  return item?.buffer ?? null;
}

function extensionToFilename(extension: string): string {
  const normalized = extension.replace(/^\./, "").toLowerCase();
  const mapped =
    normalized === "jpeg" || normalized === "jpg"
      ? ".jpg"
      : normalized === "png"
        ? ".png"
        : normalized === "webp"
          ? ".webp"
          : `.${normalized}`;

  return `embedded${mapped}`;
}

export class ImageExtractionService {
  async processEmbeddedImages(
    input: ProcessEmbeddedImagesInput,
  ): Promise<ProcessEmbeddedImagesResult> {
    const refs = listEmbeddedImageRefs(input.workbook, input.sheet);
    const records: ProcessedImageRecord[] = [];
    const warnings: string[] = [];
    const stats = {
      extracted: 0,
      associated: 0,
      pendingReview: 0,
      rejected: 0,
      ambiguous: 0,
    };

    const productImageCounts = new Map<string, number>();

    for (const ref of refs) {
      stats.extracted += 1;

      const buffer = getEmbeddedImageBuffer(input.workbook, ref.imageId);
      if (!buffer) {
        stats.rejected += 1;
        const created = await productImageRepository.create({
          importJobId: input.importJobId,
          originalName: `embedded-row-${ref.row}`,
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
          `Fila ${ref.row}: no se pudo extraer la imagen embebida.`,
        );
        continue;
      }

      const media = getWorkbookMedia(input.workbook).find(
        (entry) => entry.index === ref.imageId,
      );
      const originalName = extensionToFilename(media?.extension ?? ".png");
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

      const productId = input.rowToProductId.get(ref.row) ?? null;
      let status: ProductImageStatus = "PENDING_REVIEW";

      if (productId) {
        status = "ASSOCIATED_AUTO";
        stats.associated += 1;
      } else {
        stats.pendingReview += 1;
      }

      let storagePath: string | null = null;
      let thumbnailPath: string | null = null;

      if (productId) {
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

        const count = productImageCounts.get(productId) ?? 0;
        productImageCounts.set(productId, count + 1);
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
        sortOrder: productId ? (productImageCounts.get(productId) ?? 1) - 1 : 0,
        isPrimary: productId ? (productImageCounts.get(productId) ?? 0) === 1 : false,
        label: ref.columnHeader,
        sourceSheet: ref.sheetName,
        sourceRow: ref.row,
        sourceColumn: ref.columnHeader,
        status,
        source: "EMBEDDED",
      });

      records.push({ id: created.id, status: created.status, productId });
    }

    return { records, warnings, stats };
  }
}

export const imageExtractionService = new ImageExtractionService();
