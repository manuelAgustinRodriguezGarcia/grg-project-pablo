import type { ImportJobStatus } from "@/generated/prisma/client";
import { requireAuth, requireRole } from "@/server/auth";
import { importJobRepository } from "@/server/repositories/import-job.repository";
import { uploadedFileRepository } from "@/server/repositories/uploaded-file.repository";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { UploadedFileError } from "@/server/services/uploaded-file.errors";
import {
  hasRetainedImport,
  uploadedFileRetentionService,
} from "@/server/services/uploaded-file-retention";
import {
  toUploadedFileDetail,
  toUploadedFileListItem,
  type UploadedFileDownloadResponse,
  type UploadedFileListResponse,
  type UploadedFileReportResponse,
} from "@/features/files/types/uploaded-file.types";
import { createSignedDownloadUrl, deleteFile } from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";

const REPORT_AVAILABLE_STATUSES: ImportJobStatus[] = [
  "PUBLISHED",
  "FAILED",
  "PENDING_REVIEW",
];

export class UploadedFileService {
  private async requireRetainedFile(fileId: string) {
    const file = await uploadedFileRepository.findByIdWithHistory(fileId);
    if (!file || !hasRetainedImport(file.importJobs)) {
      throw new UploadedFileError("Archivo no encontrado.", "FILE_NOT_FOUND");
    }
    return file;
  }

  async listFiles(input: {
    page: number;
    pageSize: number;
    query?: string;
  }): Promise<UploadedFileListResponse> {
    await requireAuth();

    const paginated = await uploadedFileRepository.findManyPaginated({
      page: input.page,
      pageSize: input.pageSize,
      query: input.query,
    });

    return {
      items: paginated.items.map(toUploadedFileListItem),
      pagination: {
        page: paginated.page,
        pageSize: paginated.pageSize,
        total: paginated.total,
        totalPages: paginated.totalPages,
      },
    };
  }

  async getFileDetail(fileId: string) {
    await requireRole("ADMIN");
    const file = await this.requireRetainedFile(fileId);
    return toUploadedFileDetail(file);
  }

  async getDownloadUrl(fileId: string): Promise<UploadedFileDownloadResponse> {
    await requireAuth();
    const file = await this.requireRetainedFile(fileId);

    const signed = await createSignedDownloadUrl(
      STORAGE_BUCKETS.EXCEL_ORIGINALS,
      file.storagePath,
    );

    return {
      url: signed.signedUrl,
      expiresAt: new Date(
        Date.now() + signed.expiresInSeconds * 1000,
      ).toISOString(),
      originalName: file.originalName,
    };
  }

  async getReport(
    fileId: string,
    jobId?: string,
  ): Promise<UploadedFileReportResponse> {
    await requireRole("ADMIN");
    const file = await this.requireRetainedFile(fileId);

    const targetJob = jobId
      ? file.importJobs.find((job) => job.id === jobId)
      : file.importJobs.find((job) =>
          REPORT_AVAILABLE_STATUSES.includes(job.status as ImportJobStatus),
        );

    if (!targetJob) {
      throw new UploadedFileError(
        jobId
          ? "La importación no pertenece a este archivo."
          : "No hay informe disponible para este archivo.",
        "VALIDATION_ERROR",
      );
    }

    if (!REPORT_AVAILABLE_STATUSES.includes(targetJob.status as ImportJobStatus)) {
      throw new UploadedFileError(
        "El informe solo está disponible para importaciones finalizadas.",
        "VALIDATION_ERROR",
      );
    }

    const report =
      typeof targetJob.resultados === "object" && targetJob.resultados !== null
        ? (targetJob.resultados as Record<string, unknown>)
        : null;

    return {
      fileId: file.id,
      jobId: targetJob.id,
      status: targetJob.status as ImportJobStatus,
      report,
      errorMessage: targetJob.errorMessage,
      finishedAt: targetJob.finishedAt?.toISOString() ?? null,
    };
  }

  async reprocess(fileId: string) {
    const { profile: admin } = await requireRole("ADMIN");
    const file = await this.requireRetainedFile(fileId);

    const active = await importJobRepository.findActiveByUploadedFileId(fileId);
    if (active) {
      throw new UploadedFileError(
        "Hay una importación en curso para este archivo.",
        "ACTIVE_JOB_EXISTS",
      );
    }

    const result = await catalogImportService.createJobFromUploadedFile(fileId);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.FILE_REPROCESSED,
      entityType: AUDIT_ENTITY_TYPES.UPLOADED_FILE,
      entityId: fileId,
    });

    return result;
  }

  async deleteFile(fileId: string, input: { confirmed: boolean }) {
    const { profile: admin } = await requireRole("ADMIN");
    const file = await this.requireRetainedFile(fileId);

    await importJobRepository.cancelAllActiveByUploadedFileId(fileId);

    const requiresConfirmation =
      await importJobRepository.hasPublishedOrPendingReviewJob(fileId);

    if (requiresConfirmation && !input.confirmed) {
      throw new UploadedFileError(
        "Debe confirmar la eliminación porque el archivo tiene importaciones publicadas.",
        "CONFIRMATION_REQUIRED",
      );
    }

    await deleteFile(STORAGE_BUCKETS.EXCEL_ORIGINALS, file.storagePath);
    await uploadedFileRepository.deleteById(fileId);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.FILE_DELETED,
      entityType: AUDIT_ENTITY_TYPES.UPLOADED_FILE,
      entityId: fileId,
    });

    return { success: true as const };
  }

  async cleanupOrphanFiles(input?: { dryRun?: boolean }) {
    await requireRole("ADMIN");
    const dryRun = input?.dryRun ?? false;

    const files = await uploadedFileRepository.findAllWithHistory();
    const orphans = files.filter((file) => !hasRetainedImport(file.importJobs));

    const deleted: Array<{ id: string; originalName: string }> = [];
    const errors: Array<{ id: string; originalName: string; error: string }> = [];

    for (const file of orphans) {
      if (dryRun) {
        deleted.push({ id: file.id, originalName: file.originalName });
        continue;
      }

      try {
        const purged = await uploadedFileRetentionService.purgeIfWithoutRetainedImport(
          file.id,
        );
        if (purged) {
          deleted.push({ id: file.id, originalName: file.originalName });
        }
      } catch (error) {
        errors.push({
          id: file.id,
          originalName: file.originalName,
          error: error instanceof Error ? error.message : "Error desconocido.",
        });
      }
    }

    return {
      dryRun,
      scanned: files.length,
      orphanCount: orphans.length,
      deleted,
      errors,
    };
  }
}

export const uploadedFileService = new UploadedFileService();
