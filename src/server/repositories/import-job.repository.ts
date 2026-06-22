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

export type CreateImportJobData = {
  uploadedFileId: string;
  status?: ImportJobStatus;
};

export type UpdateImportJobData = {
  catalogId?: string | null;
  folderId?: string | null;
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
  sheets: ImportSheet[];
  preview: ImportPreview | null;
};

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
