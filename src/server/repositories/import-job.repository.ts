import type {
  ImportActionType,
  ImportJob,
  ImportJobStatus,
  ImportPreview,
  ImportSheet,
  ImportSheetClassification,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";
import { RETAINED_IMPORT_JOB_STATUSES } from "@/server/services/uploaded-file-retention";

export type CreateImportJobData = {
  uploadedFileId: string;
  status?: ImportJobStatus;
  destinationType?: "CATALOG_FOLDER" | "PRICE_LIST";
};

export type UpdateImportJobData = {
  destinationType?: "CATALOG_FOLDER" | "PRICE_LIST";
  catalogId?: string | null;
  folderId?: string | null;
  priceListId?: string | null;
  targetSheetName?: string | null;
  status?: ImportJobStatus;
  actionType?: ImportActionType | null;
  config?: Prisma.InputJsonValue;
  resultados?: Prisma.InputJsonValue;
  progress?: Prisma.InputJsonValue;
  errorMessage?: string | null;
  finishedAt?: Date | null;
};

export type CreateImportSheetData = {
  importJobId: string;
  sheetName: string;
  classification: ImportSheetClassification;
  rowCount: number;
  columnCount: number;
  detectedHeaders?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

export type CreateImportPreviewData = {
  importJobId: string;
  recognizedProducts: Prisma.InputJsonValue;
  matchedProducts?: Prisma.InputJsonValue;
  errors?: Prisma.InputJsonValue;
  warnings?: Prisma.InputJsonValue;
  summary: Prisma.InputJsonValue;
};

export type ImportJobWithRelations = ImportJob & {
  uploadedFile: { id: string; originalName: string; storagePath: string; mimeType: string; sizeBytes: number };
  catalog: { id: string; name: string } | null;
  folder: { id: string; name: string; catalogId: string } | null;
  priceList: { id: string; name: string } | null;
  sheets: ImportSheet[];
  preview: ImportPreview | null;
};

const TERMINAL_IMPORT_JOB_STATUSES: ImportJobStatus[] = [
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
];

export class ImportJobRepository {
  async create(data: CreateImportJobData): Promise<ImportJob> {
    return prisma.importJob.create({
      data: {
        uploadedFileId: data.uploadedFileId,
        status: data.status ?? "STORED",
      },
    });
  }

  async findById(id: string): Promise<ImportJob | null> {
    return prisma.importJob.findUnique({ where: { id } });
  }

  async findActiveByUploadedFileId(uploadedFileId: string): Promise<ImportJob | null> {
    return prisma.importJob.findFirst({
      where: {
        uploadedFileId,
        status: { notIn: TERMINAL_IMPORT_JOB_STATUSES },
      },
    });
  }

  async cancelAllActiveByUploadedFileId(uploadedFileId: string): Promise<number> {
    const result = await prisma.importJob.updateMany({
      where: {
        uploadedFileId,
        status: { notIn: TERMINAL_IMPORT_JOB_STATUSES },
      },
      data: {
        status: "CANCELLED",
        finishedAt: new Date(),
        progress: {
          phase: "cancelled",
          percent: 100,
          message: "Importación cancelada por eliminación del archivo.",
        },
      },
    });

    return result.count;
  }

  async findByUploadedFileId(uploadedFileId: string) {
    return prisma.importJob.findMany({
      where: { uploadedFileId },
      orderBy: { createdAt: "desc" },
      include: {
        catalog: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true, catalogId: true } },
        sheets: { select: { id: true, sheetName: true } },
      },
    });
  }

  async hasPublishedOrPendingReviewJob(uploadedFileId: string): Promise<boolean> {
    const count = await prisma.importJob.count({
      where: {
        uploadedFileId,
        status: { in: RETAINED_IMPORT_JOB_STATUSES },
      },
    });
    return count > 0;
  }

  async findRetainedUploadedFileIdsByCatalogId(catalogId: string): Promise<string[]> {
    const jobs = await prisma.importJob.findMany({
      where: {
        catalogId,
        status: { in: RETAINED_IMPORT_JOB_STATUSES },
      },
      select: { uploadedFileId: true },
      distinct: ["uploadedFileId"],
    });
    return jobs.map((job) => job.uploadedFileId);
  }

  async findRetainedUploadedFileIdsByFolderId(folderId: string): Promise<string[]> {
    const jobs = await prisma.importJob.findMany({
      where: {
        folderId,
        status: { in: RETAINED_IMPORT_JOB_STATUSES },
      },
      select: { uploadedFileId: true },
      distinct: ["uploadedFileId"],
    });
    return jobs.map((job) => job.uploadedFileId);
  }

  async findRetainedUploadedFileIdsByPriceListId(priceListId: string): Promise<string[]> {
    const jobs = await prisma.importJob.findMany({
      where: {
        priceListId,
        status: { in: RETAINED_IMPORT_JOB_STATUSES },
      },
      select: { uploadedFileId: true },
      distinct: ["uploadedFileId"],
    });
    return jobs.map((job) => job.uploadedFileId);
  }

  async findByIdWithRelations(id: string): Promise<ImportJobWithRelations | null> {
    return prisma.importJob.findUnique({
      where: { id },
      include: {
        uploadedFile: {
          select: {
            id: true,
            originalName: true,
            storagePath: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
        catalog: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true, catalogId: true } },
        priceList: { select: { id: true, name: true } },
        sheets: { orderBy: { sheetName: "asc" } },
        preview: true,
      },
    });
  }

  async update(id: string, data: UpdateImportJobData): Promise<ImportJob> {
    return prisma.importJob.update({ where: { id }, data });
  }

  async replaceSheets(
    importJobId: string,
    sheets: CreateImportSheetData[],
  ): Promise<ImportSheet[]> {
    await prisma.importSheet.deleteMany({ where: { importJobId } });

    if (sheets.length === 0) {
      return [];
    }

    await prisma.importSheet.createMany({ data: sheets });

    return prisma.importSheet.findMany({
      where: { importJobId },
      orderBy: { sheetName: "asc" },
    });
  }

  async upsertPreview(data: CreateImportPreviewData): Promise<ImportPreview> {
    return prisma.importPreview.upsert({
      where: { importJobId: data.importJobId },
      create: {
        importJobId: data.importJobId,
        recognizedProducts: data.recognizedProducts,
        matchedProducts: data.matchedProducts ?? [],
        errors: data.errors ?? [],
        warnings: data.warnings ?? [],
        summary: data.summary,
      },
      update: {
        recognizedProducts: data.recognizedProducts,
        matchedProducts: data.matchedProducts ?? [],
        errors: data.errors ?? [],
        warnings: data.warnings ?? [],
        summary: data.summary,
      },
    });
  }

  async deletePreview(importJobId: string): Promise<void> {
    await prisma.importPreview.deleteMany({ where: { importJobId } });
  }
}

export const importJobRepository = new ImportJobRepository();
