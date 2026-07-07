import type { ImportActionType, ImportJobStatus } from "@/generated/prisma/client";
import type {
  UploadedFileJobSummary,
  UploadedFileWithHistory,
} from "@/server/repositories/uploaded-file.repository";
import {
  hasRetainedImport,
  type ImportJobRetentionSummary,
} from "@/server/services/uploaded-file-retention";

export type UploadedFileDestinationType = "CATALOG" | "PRICE_LIST";

export type UploadedFileUserSummary = {
  id: string;
  name: string;
  email: string;
};

export type UploadedFileJobListItem = {
  id: string;
  status: ImportJobStatus;
  destinationType: "CATALOG_FOLDER" | "PRICE_LIST";
  catalog: { id: string; name: string } | null;
  folder: { id: string; name: string; catalogId: string } | null;
  priceList: { id: string; name: string } | null;
  actionType: ImportActionType | null;
  finishedAt: string | null;
  createdAt: string;
  sheetCount: number;
  targetSheetName: string | null;
};

export type UploadedFileLatestJobSummary = {
  id: string;
  status: ImportJobStatus;
  destinationType: "CATALOG_FOLDER" | "PRICE_LIST";
  catalog: { id: string; name: string } | null;
  folder: { id: string; name: string; catalogId: string } | null;
  priceList: { id: string; name: string } | null;
  actionType: ImportActionType | null;
  finishedAt: string | null;
  sheetsDetected: number;
  sheetImported: string | null;
  productsCreated: number;
  productsSkipped: number;
  itemsProcessed: number;
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

function readReportMetrics(
  resultados: unknown,
  destinationType: "CATALOG_FOLDER" | "PRICE_LIST",
) {
  if (typeof resultados !== "object" || resultados === null) {
    return {
      sheetsDetected: 0,
      sheetImported: null as string | null,
      productsCreated: 0,
      productsSkipped: 0,
      itemsProcessed: 0,
      errorCount: 0,
    };
  }

  const report = resultados as Record<string, unknown>;
  const errors = Array.isArray(report.errors) ? report.errors : [];

  const isPriceReport =
    destinationType === "PRICE_LIST" ||
    typeof report.priceListName === "string" ||
    typeof report.itemsProcessed === "number";

  if (isPriceReport) {
    const itemsCreated =
      typeof report.itemsCreated === "number" ? report.itemsCreated : 0;
    const itemsSkipped =
      typeof report.itemsSkipped === "number" ? report.itemsSkipped : 0;
    const itemsProcessed =
      typeof report.itemsProcessed === "number"
        ? report.itemsProcessed
        : itemsCreated + itemsSkipped;

    return {
      sheetsDetected: 0,
      sheetImported:
        typeof report.sheetImported === "string" ? report.sheetImported : null,
      productsCreated: itemsCreated,
      productsSkipped: itemsSkipped,
      itemsProcessed,
      errorCount: errors.length,
    };
  }

  return {
    sheetsDetected: typeof report.sheetsDetected === "number" ? report.sheetsDetected : 0,
    sheetImported:
      typeof report.sheetImported === "string" ? report.sheetImported : null,
    productsCreated:
      typeof report.productsCreated === "number" ? report.productsCreated : 0,
    productsSkipped:
      typeof report.productsSkipped === "number" ? report.productsSkipped : 0,
    itemsProcessed: 0,
    errorCount: errors.length,
  };
}

function toLatestJobSummary(
  job: UploadedFileJobSummary | undefined,
): UploadedFileLatestJobSummary | null {
  if (!job) {
    return null;
  }

  const destinationType =
    job.destinationType === "PRICE_LIST" ? "PRICE_LIST" : "CATALOG_FOLDER";

  const metrics = readReportMetrics(job.resultados, destinationType);

  return {
    id: job.id,
    status: job.status as ImportJobStatus,
    destinationType,
    catalog: job.catalog,
    folder: job.folder,
    priceList: job.priceList,
    actionType: job.actionType as ImportActionType | null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    sheetsDetected: job.sheets.length || metrics.sheetsDetected,
    sheetImported: job.targetSheetName ?? metrics.sheetImported,
    productsCreated: metrics.productsCreated,
    productsSkipped: metrics.productsSkipped,
    itemsProcessed: metrics.itemsProcessed,
    errorCount: metrics.errorCount,
  };
}

function findLatestTerminalJob(jobs: UploadedFileJobSummary[]) {
  return jobs.find((job) =>
    TERMINAL_JOB_STATUSES.includes(job.status as ImportJobStatus),
  );
}

function toJobListItem(job: UploadedFileJobSummary): UploadedFileJobListItem {
  const destinationType =
    job.destinationType === "PRICE_LIST" ? "PRICE_LIST" : "CATALOG_FOLDER";

  return {
    id: job.id,
    status: job.status as ImportJobStatus,
    destinationType,
    catalog: job.catalog,
    folder: job.folder,
    priceList: job.priceList,
    actionType: job.actionType as ImportActionType | null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    sheetCount: job.sheets.length,
    targetSheetName: job.targetSheetName,
  };
}

export function isUploadedFileAnchored(jobs: ImportJobRetentionSummary[]): boolean {
  return hasRetainedImport(jobs);
}

function resolveDestinationType(
  jobs: UploadedFileJobSummary[],
): UploadedFileDestinationType {
  const priceJob = jobs.find(
    (job) => job.destinationType === "PRICE_LIST" || job.priceListId !== null,
  );
  if (priceJob) {
    return "PRICE_LIST";
  }

  return "CATALOG";
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
    destinationType: resolveDestinationType(file.importJobs),
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
