import type { ImportActionType, ImportJobStatus } from "@/generated/prisma/client";
import type {
  UploadedFileJobSummary,
  UploadedFileWithHistory,
} from "@/server/repositories/uploaded-file.repository";

export type UploadedFileDestinationType = "CATALOG";

export type UploadedFileUserSummary = {
  id: string;
  name: string;
  email: string;
};

export type UploadedFileJobListItem = {
  id: string;
  status: ImportJobStatus;
  catalog: { id: string; name: string } | null;
  folder: { id: string; name: string; catalogId: string } | null;
  actionType: ImportActionType | null;
  finishedAt: string | null;
  createdAt: string;
  sheetCount: number;
  targetSheetName: string | null;
};

export type UploadedFileLatestJobSummary = {
  id: string;
  status: ImportJobStatus;
  catalog: { id: string; name: string } | null;
  folder: { id: string; name: string; catalogId: string } | null;
  actionType: ImportActionType | null;
  finishedAt: string | null;
  sheetsDetected: number;
  sheetImported: string | null;
  productsCreated: number;
  productsSkipped: number;
  errorCount: number;
};

export type UploadedFileListItem = {
  id: string;
  originalName: string;
  extension: string;
  sizeBytes: number;
  mimeType: string;
  status: string;
  uploadedAt: string;
  uploadedBy: UploadedFileUserSummary;
  destinationType: UploadedFileDestinationType;
  jobCount: number;
  latestJob: UploadedFileLatestJobSummary | null;
};

export type UploadedFileDetail = UploadedFileListItem & {
  storagePath: string;
  updatedAt: string;
  jobs: UploadedFileJobListItem[];
};

export type UploadedFileDownloadResponse = {
  url: string;
  expiresAt: string;
  originalName: string;
};

export type UploadedFileReportResponse = {
  fileId: string;
  jobId: string;
  status: ImportJobStatus;
  report: Record<string, unknown> | null;
  errorMessage: string | null;
  finishedAt: string | null;
};

export type UploadedFileListResponse = {
  items: UploadedFileListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const TERMINAL_JOB_STATUSES: ImportJobStatus[] = [
  "PUBLISHED",
  "FAILED",
  "PENDING_REVIEW",
];

export function parseExtension(originalName: string): string {
  const lastDot = originalName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === originalName.length - 1) {
    return "";
  }
  return originalName.slice(lastDot + 1).toLowerCase();
}

function readReportMetrics(resultados: unknown) {
  if (typeof resultados !== "object" || resultados === null) {
    return {
      sheetsDetected: 0,
      sheetImported: null as string | null,
      productsCreated: 0,
      productsSkipped: 0,
      errorCount: 0,
    };
  }

  const report = resultados as Record<string, unknown>;
  const errors = Array.isArray(report.errors) ? report.errors : [];

  return {
    sheetsDetected: typeof report.sheetsDetected === "number" ? report.sheetsDetected : 0,
    sheetImported:
      typeof report.sheetImported === "string" ? report.sheetImported : null,
    productsCreated:
      typeof report.productsCreated === "number" ? report.productsCreated : 0,
    productsSkipped:
      typeof report.productsSkipped === "number" ? report.productsSkipped : 0,
    errorCount: errors.length,
  };
}

function toLatestJobSummary(
  job: UploadedFileJobSummary | undefined,
): UploadedFileLatestJobSummary | null {
  if (!job) {
    return null;
  }

  const metrics = readReportMetrics(job.resultados);

  return {
    id: job.id,
    status: job.status as ImportJobStatus,
    catalog: job.catalog,
    folder: job.folder,
    actionType: job.actionType as ImportActionType | null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    sheetsDetected: job.sheets.length || metrics.sheetsDetected,
    sheetImported: job.targetSheetName ?? metrics.sheetImported,
    productsCreated: metrics.productsCreated,
    productsSkipped: metrics.productsSkipped,
    errorCount: metrics.errorCount,
  };
}

function findLatestTerminalJob(jobs: UploadedFileJobSummary[]) {
  return jobs.find((job) =>
    TERMINAL_JOB_STATUSES.includes(job.status as ImportJobStatus),
  );
}

function toJobListItem(job: UploadedFileJobSummary): UploadedFileJobListItem {
  return {
    id: job.id,
    status: job.status as ImportJobStatus,
    catalog: job.catalog,
    folder: job.folder,
    actionType: job.actionType as ImportActionType | null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    sheetCount: job.sheets.length,
    targetSheetName: job.targetSheetName,
  };
}

export function toUploadedFileListItem(
  file: UploadedFileWithHistory,
): UploadedFileListItem {
  const latestJob = findLatestTerminalJob(file.importJobs);

  return {
    id: file.id,
    originalName: file.originalName,
    extension: parseExtension(file.originalName),
    sizeBytes: file.sizeBytes,
    mimeType: file.mimeType,
    status: file.status,
    uploadedAt: file.createdAt.toISOString(),
    uploadedBy: file.uploadedBy,
    destinationType: "CATALOG",
    jobCount: file.importJobs.length,
    latestJob: toLatestJobSummary(latestJob),
  };
}

export function toUploadedFileDetail(
  file: UploadedFileWithHistory,
): UploadedFileDetail {
  const base = toUploadedFileListItem(file);

  return {
    ...base,
    storagePath: file.storagePath,
    updatedAt: file.updatedAt.toISOString(),
    jobs: file.importJobs.map(toJobListItem),
  };
}
