import type {
  ImportActionType,
  ImportJobStatus,
  ImportSheetClassification,
  Prisma,
} from "@/generated/prisma/client";
import { requireRole } from "@/server/auth";
import {
  buildExistingCodeIndex,
  detectSemanticFlags,
  findMatchingProductId,
  mapSheetToProducts,
  parseWorkbookFromBuffer,
  type ImportJobConfig,
  type MappedProductRow,
  type ParsedSheet,
} from "@/server/importers";
import { columnRepository } from "@/server/repositories/column.repository";
import { importJobRepository } from "@/server/repositories/import-job.repository";
import { productRepository } from "@/server/repositories/product.repository";
import { uploadedFileRepository } from "@/server/repositories/uploaded-file.repository";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { prisma } from "@/server/database/prisma";
import {
  buildStoragePath,
  downloadFile,
  uploadFile,
} from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";
import { StorageError } from "@/server/storage/errors";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { ImportError } from "./import.errors";

const BATCH_SIZE = 500;

const TERMINAL_STATUSES: ImportJobStatus[] = [
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
];

export type UploadImportFileInput = {
  buffer: Buffer;
  originalFilename: string;
  contentType: string;
};

export type SetImportDestinationInput = {
  catalogId: string;
  folderId: string;
  sheetName: string;
};

export type SetImportConfigInput = ImportJobConfig;

export type ApplyImportInput = {
  actionType: ImportActionType;
  confirmed: boolean;
};

export type ImportProgress = {
  phase: string;
  percent: number;
  message: string;
};

export type ImportReport = {
  fileName: string;
  catalogName: string | null;
  folderName: string | null;
  sheetImported: string | null;
  sheetsDetected: number;
  productsProcessed: number;
  productsCreated: number;
  productsSkipped: number;
  productsMatched: number;
  formulasDetected: number;
  formulasWithoutCachedValue: number;
  imagesDetected: number;
  columnsDetected: number;
  columnsCreated: number;
  errors: string[];
  warnings: string[];
  actionApplied: ImportActionType | null;
};

function assertStatus(current: ImportJobStatus, allowed: ImportJobStatus[]): void {
  if (!allowed.includes(current)) {
    throw new ImportError(
      `Estado de importación inválido: ${current}.`,
      "INVALID_STATE",
    );
  }
}

function toClassification(
  classification: ParsedSheet["classification"],
): ImportSheetClassification {
  return classification;
}

function countFormulas(products: MappedProductRow[]): {
  formulasDetected: number;
  formulasWithoutCachedValue: number;
} {
  let formulasDetected = 0;
  let formulasWithoutCachedValue = 0;

  for (const product of products) {
    for (const formula of product.formulas) {
      formulasDetected += 1;
      if (!formula.hasCachedValue) {
        formulasWithoutCachedValue += 1;
      }
    }
  }

  return { formulasDetected, formulasWithoutCachedValue };
}

export class CatalogImportService {
  async uploadAndCreateJob(input: UploadImportFileInput) {
    const { profile: admin } = await requireRole("ADMIN");

    let uploaded;
    try {
      uploaded = await uploadFile({
        bucket: STORAGE_BUCKETS.EXCEL_ORIGINALS,
        path: buildStoragePath("imports", input.originalFilename),
        body: input.buffer,
        contentType: input.contentType,
        originalFilename: input.originalFilename,
        auditContext: { userId: admin.id },
      });
    } catch (error) {
      if (error instanceof StorageError) {
        throw new ImportError(error.message, "INVALID_FILE");
      }
      throw error;
    }

    const uploadedFile = await uploadedFileRepository.create({
      originalName: input.originalFilename,
      storagePath: uploaded.path,
      mimeType: uploaded.contentType,
      sizeBytes: uploaded.sizeBytes,
      uploadedById: admin.id,
    });

    const job = await importJobRepository.create({
      uploadedFileId: uploadedFile.id,
      status: "STORED",
    });

    return { jobId: job.id, uploadedFileId: uploadedFile.id };
  }

  async getJob(jobId: string) {
    await requireRole("ADMIN");
    const job = await importJobRepository.findByIdWithRelations(jobId);

    if (!job) {
      throw new ImportError("Importación no encontrada.", "IMPORT_NOT_FOUND");
    }

    return job;
  }

  async analyzeJob(jobId: string) {
    await requireRole("ADMIN");
    const job = await importJobRepository.findByIdWithRelations(jobId);

    if (!job) {
      throw new ImportError("Importación no encontrada.", "IMPORT_NOT_FOUND");
    }

    assertStatus(job.status, ["STORED", "PENDING_DESTINATION"]);

    await importJobRepository.update(jobId, {
      status: "ANALYZING",
      progress: { phase: "analyze", percent: 10, message: "Analizando archivo..." },
      errorMessage: null,
    });

    try {
      const buffer = await downloadFile(
        STORAGE_BUCKETS.EXCEL_ORIGINALS,
        job.uploadedFile.storagePath,
      );
      const workbook = await parseWorkbookFromBuffer(buffer);

      await importJobRepository.replaceSheets(
        jobId,
        workbook.sheets.map((sheet) => ({
          importJobId: jobId,
          sheetName: sheet.sheetName,
          classification: toClassification(sheet.classification),
          rowCount: sheet.rowCount,
          columnCount: sheet.columnCount,
          detectedHeaders: sheet.headers,
          metadata: {
            classificationReason: sheet.classificationReason,
            headerRow: sheet.headerRow,
            imageCount: sheet.imageCount,
          },
        })),
      );

      await uploadedFileRepository.updateStatus(job.uploadedFileId, "PROCESSED");

      return importJobRepository.update(jobId, {
        status: "PENDING_DESTINATION",
        progress: {
          phase: "destination",
          percent: 40,
          message: "Seleccione catálogo, carpeta y hoja destino.",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al analizar el archivo.";

      await importJobRepository.update(jobId, {
        status: "FAILED",
        errorMessage: message,
        finishedAt: new Date(),
        progress: { phase: "failed", percent: 100, message },
      });

      await uploadedFileRepository.updateStatus(job.uploadedFileId, "FAILED");
      throw new ImportError(message, "ANALYSIS_FAILED");
    }
  }

  async setDestination(jobId: string, input: SetImportDestinationInput) {
    await requireRole("ADMIN");
    const job = await importJobRepository.findByIdWithRelations(jobId);

    if (!job) {
      throw new ImportError("Importación no encontrada.", "IMPORT_NOT_FOUND");
    }

    assertStatus(job.status, ["PENDING_DESTINATION", "PENDING_CONFIG", "READY_TO_APPLY"]);

    const sheet = job.sheets.find((item) => item.sheetName === input.sheetName);
    if (!sheet) {
      throw new ImportError("Hoja no encontrada en el archivo.", "VALIDATION_ERROR");
    }

    if (sheet.classification !== "IMPORTABLE") {
      throw new ImportError(
        "La hoja seleccionada no es importable.",
        "SHEET_NOT_IMPORTABLE",
      );
    }

    const folder = await folderRepository.findById(input.folderId);
    if (!folder || folder.catalogId !== input.catalogId) {
      throw new ImportError("Carpeta destino inválida.", "VALIDATION_ERROR");
    }

    const catalog = await catalogRepository.findById(input.catalogId);
    if (!catalog) {
      throw new ImportError("Catálogo destino inválido.", "VALIDATION_ERROR");
    }

    await importJobRepository.deletePreview(jobId);

    return importJobRepository.update(jobId, {
      catalogId: input.catalogId,
      folderId: input.folderId,
      targetSheetName: input.sheetName,
      status: "PENDING_CONFIG",
      progress: {
        phase: "config",
        percent: 55,
        message: "Configure columnas y genere la vista previa.",
      },
    });
  }

  async setConfig(jobId: string, input: SetImportConfigInput) {
    await requireRole("ADMIN");
    const job = await importJobRepository.findByIdWithRelations(jobId);

    if (!job) {
      throw new ImportError("Importación no encontrada.", "IMPORT_NOT_FOUND");
    }

    assertStatus(job.status, ["PENDING_CONFIG", "READY_TO_APPLY"]);

    const config: ImportJobConfig = {
      columnMapping: input.columnMapping,
      primaryCodeColumnKey: input.primaryCodeColumnKey,
      descriptionColumnKey: input.descriptionColumnKey,
    };

    await importJobRepository.update(jobId, {
      config,
      status: "PROCESSING",
      progress: {
        phase: "preview",
        percent: 70,
        message: "Generando vista previa...",
      },
    });

    return this.buildPreview(jobId, config);
  }

  private async loadTargetSheet(job: NonNullable<Awaited<ReturnType<typeof importJobRepository.findByIdWithRelations>>>) {
    if (!job.targetSheetName) {
      throw new ImportError("Debe seleccionar una hoja destino.", "VALIDATION_ERROR");
    }

    const buffer = await downloadFile(
      STORAGE_BUCKETS.EXCEL_ORIGINALS,
      job.uploadedFile.storagePath,
    );
    const workbook = await parseWorkbookFromBuffer(buffer);
    const sheet = workbook.sheets.find((item) => item.sheetName === job.targetSheetName);

    if (!sheet) {
      throw new ImportError("Hoja destino no encontrada.", "VALIDATION_ERROR");
    }

    return sheet;
  }

  async buildPreview(jobId: string, configOverride?: ImportJobConfig) {
    await requireRole("ADMIN");
    const job = await importJobRepository.findByIdWithRelations(jobId);

    if (!job) {
      throw new ImportError("Importación no encontrada.", "IMPORT_NOT_FOUND");
    }

    if (!job.folderId) {
      throw new ImportError("Debe seleccionar carpeta destino.", "VALIDATION_ERROR");
    }

    const config = configOverride ?? ((job.config as ImportJobConfig | null) ?? {});
    const sheet = await this.loadTargetSheet(job);
    let columns = await columnRepository.findByFolderIdOrdered(job.folderId);

    if (columns.length === 0) {
      const semanticUsed = { primary: false, description: false };
      const columnsToCreate = [];

      for (let index = 0; index < sheet.headers.length; index += 1) {
        const header = sheet.headers[index];
        const flags = detectSemanticFlags(header.originalName);
        const isPrimaryCode = !semanticUsed.primary && flags.isPrimaryCode;
        const isDescription = !semanticUsed.description && flags.isDescription;

        if (isPrimaryCode) semanticUsed.primary = true;
        if (isDescription) semanticUsed.description = true;

        columnsToCreate.push({
          folderId: job.folderId,
          originalName: header.originalName,
          displayName: header.originalName,
          internalKey: header.internalKey,
          dataType: header.inferredDataType,
          order: index,
          isPrimaryCode,
          isDescription,
          isImageCode: flags.isImageCode,
          isSearchable: isPrimaryCode || isDescription,
          isFilterable: false,
        });
      }

      if (columnsToCreate.length > 0) {
        await columnRepository.createMany(columnsToCreate);
        columns = await columnRepository.findByFolderIdOrdered(job.folderId);
      }
    }

    const mappedProducts = mapSheetToProducts(sheet, columns, config);
    const existingProducts = await productRepository.findPrimaryCodesByFolder(job.folderId);
    const matchIndex = buildExistingCodeIndex(existingProducts);

    const recognizedProducts = mappedProducts.map((product) => {
      const matchedProductId = findMatchingProductId(product.primaryCode, matchIndex);
      return {
        ...product,
        isMatch: Boolean(matchedProductId),
        matchedProductId,
      };
    });

    const matchedProducts = recognizedProducts.filter((product) => product.isMatch);
    const allWarnings = recognizedProducts.flatMap((product) => product.warnings);
    const formulaStats = countFormulas(recognizedProducts);
    const productCount = await productRepository.countByFolder(job.folderId);

    const summary = {
      totalProducts: recognizedProducts.length,
      matchedCount: matchedProducts.length,
      imageCount: sheet.imageCount,
      columnCount: sheet.columnCount,
      folderProductCount: productCount,
      folderIsEmpty: productCount === 0,
      formulasDetected: formulaStats.formulasDetected,
      formulasWithoutCachedValue: formulaStats.formulasWithoutCachedValue,
    };

    await importJobRepository.upsertPreview({
      importJobId: jobId,
      recognizedProducts: recognizedProducts as unknown as Prisma.InputJsonValue,
      matchedProducts: matchedProducts as unknown as Prisma.InputJsonValue,
      errors: [],
      warnings: allWarnings,
      summary: summary as unknown as Prisma.InputJsonValue,
    });

    return importJobRepository.update(jobId, {
      status: "READY_TO_APPLY",
      progress: {
        phase: "ready",
        percent: 90,
        message: "Vista previa lista. Confirme la acción de importación.",
      },
    });
  }

  async apply(jobId: string, input: ApplyImportInput) {
    const { profile: admin } = await requireRole("ADMIN");
    const job = await importJobRepository.findByIdWithRelations(jobId);

    if (!job) {
      throw new ImportError("Importación no encontrada.", "IMPORT_NOT_FOUND");
    }

    assertStatus(job.status, ["READY_TO_APPLY"]);

    if (!job.folderId || !job.preview) {
      throw new ImportError("La importación no tiene vista previa.", "INVALID_STATE");
    }

    const folder = await folderRepository.findByIdWithProductCount(job.folderId);
    if (!folder) {
      throw new ImportError("Carpeta destino no encontrada.", "VALIDATION_ERROR");
    }

    const productCount = folder.productCount;
    const recognizedProducts = job.preview.recognizedProducts as MappedProductRow[];

    if (input.actionType === "IMPORTAR_LISTA" && productCount > 0) {
      throw new ImportError(
        "La carpeta no está vacía. Use combinar o reemplazar.",
        "FOLDER_NOT_EMPTY",
      );
    }

    if (
      (input.actionType === "COMBINAR_LISTA" ||
        input.actionType === "REEMPLAZAR_LISTA") &&
      !input.confirmed
    ) {
      throw new ImportError(
        "Debe confirmar la operación antes de aplicar.",
        "CONFIRMATION_REQUIRED",
      );
    }

    const config = (job.config as ImportJobConfig | null) ?? {};
    const sheet = await this.loadTargetSheet(job);
    const columns = await columnRepository.findByFolderIdOrdered(job.folderId);
    const mappedProducts = mapSheetToProducts(sheet, columns, config);

    let productsToInsert = mappedProducts;

    if (input.actionType === "COMBINAR_LISTA") {
      const existingProducts = await productRepository.findPrimaryCodesByFolder(job.folderId);
      const matchIndex = buildExistingCodeIndex(existingProducts);
      productsToInsert = mappedProducts.filter(
        (product) => !findMatchingProductId(product.primaryCode, matchIndex),
      );
    }

    const skippedCount = mappedProducts.length - productsToInsert.length;
    const matchedCount =
      input.actionType === "COMBINAR_LISTA"
        ? skippedCount
        : (job.preview.matchedProducts as unknown[]).length;

    try {
      await prisma.$transaction(async () => {
        if (input.actionType === "REEMPLAZAR_LISTA") {
          await productRepository.deleteByFolder(job.folderId!);
        }

        for (let offset = 0; offset < productsToInsert.length; offset += BATCH_SIZE) {
          const batch = productsToInsert.slice(offset, offset + BATCH_SIZE);
          await productRepository.createMany(
            batch.map((product) => ({
              folderId: job.folderId!,
              primaryCode: product.primaryCode,
              normalizedCode: product.normalizedCode,
              description: product.description,
              dynamicData: product.dynamicData,
              originalText: product.originalText,
              indexedText: product.originalText,
            })),
          );
        }
      });

      const formulaStats = countFormulas(mappedProducts);
      const report: ImportReport = {
        fileName: job.uploadedFile.originalName,
        catalogName: job.catalog?.name ?? null,
        folderName: job.folder?.name ?? null,
        sheetImported: job.targetSheetName,
        sheetsDetected: job.sheets.length,
        productsProcessed: mappedProducts.length,
        productsCreated: productsToInsert.length,
        productsSkipped: skippedCount,
        productsMatched: matchedCount,
        formulasDetected: formulaStats.formulasDetected,
        formulasWithoutCachedValue: formulaStats.formulasWithoutCachedValue,
        imagesDetected: sheet.imageCount,
        columnsDetected: sheet.columnCount,
        columnsCreated: columns.length,
        errors: [],
        warnings: recognizedProducts.flatMap((product) => product.warnings),
        actionApplied: input.actionType,
      };

      const updated = await importJobRepository.update(jobId, {
        status: "PUBLISHED",
        actionType: input.actionType,
        resultados: report as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
        progress: {
          phase: "published",
          percent: 100,
          message: "Importación publicada correctamente.",
        },
      });

      auditService.logOperationSafe({
        userId: admin.id,
        action: AUDIT_ACTIONS.IMPORT_PUBLISHED,
        entityType: AUDIT_ENTITY_TYPES.IMPORT,
        entityId: jobId,
      });

      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al publicar la importación.";

      await importJobRepository.update(jobId, {
        status: "FAILED",
        errorMessage: message,
        finishedAt: new Date(),
        progress: { phase: "failed", percent: 100, message },
      });

      throw new ImportError(message, "PUBLISH_FAILED");
    }
  }

  async cancel(jobId: string) {
    await requireRole("ADMIN");
    const job = await importJobRepository.findById(jobId);

    if (!job) {
      throw new ImportError("Importación no encontrada.", "IMPORT_NOT_FOUND");
    }

    if (TERMINAL_STATUSES.includes(job.status)) {
      throw new ImportError("La importación ya finalizó.", "INVALID_STATE");
    }

    return importJobRepository.update(jobId, {
      status: "CANCELLED",
      finishedAt: new Date(),
      progress: {
        phase: "cancelled",
        percent: 100,
        message: "Importación cancelada.",
      },
    });
  }
}

export const catalogImportService = new CatalogImportService();
