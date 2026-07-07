import type { ImportJobStatus, Prisma } from "@/generated/prisma/client";
import { importJobRepository } from "@/server/repositories/import-job.repository";
import { uploadedFileRepository } from "@/server/repositories/uploaded-file.repository";
import { deleteFile } from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";

export const RETAINED_IMPORT_JOB_STATUSES: ImportJobStatus[] = [
  "PUBLISHED",
  "PENDING_REVIEW",
];

export type ImportJobRetentionSummary = {
  status: string;
  catalogId: string | null;
  folderId: string | null;
  priceListId: string | null;
};

export const retainedUploadedFileWhere: Prisma.UploadedFileWhereInput = {
  importJobs: {
    some: {
      status: { in: RETAINED_IMPORT_JOB_STATUSES },
      OR: [
        {
          AND: [{ catalogId: { not: null } }, { folderId: { not: null } }],
        },
        { priceListId: { not: null } },
      ],
    },
  },
};

export function isRetainedImportJob(job: ImportJobRetentionSummary): boolean {
  if (!RETAINED_IMPORT_JOB_STATUSES.includes(job.status as ImportJobStatus)) {
    return false;
  }

  return (
    (job.catalogId !== null && job.folderId !== null) || job.priceListId !== null
  );
}

export function hasRetainedImport(jobs: ImportJobRetentionSummary[]): boolean {
  return jobs.some(isRetainedImportJob);
}

export class UploadedFileRetentionService {
  private async purgeFileRecord(file: { id: string; storagePath: string }): Promise<void> {
    await importJobRepository.cancelAllActiveByUploadedFileId(file.id);
    await deleteFile(STORAGE_BUCKETS.EXCEL_ORIGINALS, file.storagePath);
    await uploadedFileRepository.deleteById(file.id);
  }

  async purgeIfWithoutRetainedImport(uploadedFileId: string): Promise<boolean> {
    const file = await uploadedFileRepository.findByIdWithHistory(uploadedFileId);
    if (!file) {
      return false;
    }

    if (hasRetainedImport(file.importJobs)) {
      return false;
    }

    await this.purgeFileRecord(file);
    return true;
  }

  async purgeAllUnretained(): Promise<number> {
    const files = await uploadedFileRepository.findAllWithHistory();
    const targets = files.filter((file) => !hasRetainedImport(file.importJobs));
    let deleted = 0;

    for (const file of targets) {
      await this.purgeFileRecord(file);
      deleted += 1;
    }

    return deleted;
  }

  async purgeFilesForCatalog(catalogId: string): Promise<number> {
    const fileIds = await importJobRepository.findRetainedUploadedFileIdsByCatalogId(
      catalogId,
    );
    return this.purgeFilesWhenAllRetainedJobsMatch(fileIds, (job) => job.catalogId === catalogId);
  }

  async purgeFilesForFolder(folderId: string): Promise<number> {
    const fileIds = await importJobRepository.findRetainedUploadedFileIdsByFolderId(folderId);
    return this.purgeFilesWhenAllRetainedJobsMatch(fileIds, (job) => job.folderId === folderId);
  }

  async purgeFilesForPriceList(priceListId: string): Promise<number> {
    const fileIds =
      await importJobRepository.findRetainedUploadedFileIdsByPriceListId(priceListId);
    return this.purgeFilesWhenAllRetainedJobsMatch(
      fileIds,
      (job) => job.priceListId === priceListId,
    );
  }

  private async purgeFilesWhenAllRetainedJobsMatch(
    fileIds: string[],
    matchesScope: (job: ImportJobRetentionSummary) => boolean,
  ): Promise<number> {
    let deleted = 0;

    for (const fileId of fileIds) {
      const file = await uploadedFileRepository.findByIdWithHistory(fileId);
      if (!file) {
        continue;
      }

      const retainedJobs = file.importJobs.filter(isRetainedImportJob);
      if (retainedJobs.length === 0) {
        continue;
      }

      if (!retainedJobs.every(matchesScope)) {
        continue;
      }

      await this.purgeFileRecord(file);
      deleted += 1;
    }

    return deleted;
  }
}

export const uploadedFileRetentionService = new UploadedFileRetentionService();
