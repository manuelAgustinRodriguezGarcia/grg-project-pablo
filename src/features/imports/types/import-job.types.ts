import type {
  ImportActionType,
  ImportJobStatus,
  ImportSheetClassification,
} from "@/generated/prisma/client";
import type { ImportJobWithRelations } from "@/server/repositories/import-job.repository";
import type { MappedProductRow } from "@/server/importers";

export type ImportActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type ImportJobDetail = {
  id: string;
  status: ImportJobStatus;
  actionType: ImportActionType | null;
  catalogId: string | null;
  folderId: string | null;
  targetSheetName: string | null;
  uploadedFile: {
    id: string;
    originalName: string;
    sizeBytes: number;
    mimeType: string;
  };
  catalog: { id: string; name: string } | null;
  folder: { id: string; name: string; catalogId: string } | null;
  progress: ImportProgressDto | null;
  errorMessage: string | null;
  summary: ImportPreviewSummary | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImportProgressDto = {
  phase: string;
  percent: number;
  message: string;
};

export type ImportSheetItem = {
  id: string;
  sheetName: string;
  classification: ImportSheetClassification;
  rowCount: number;
  columnCount: number;
  detectedHeaders: unknown;
  metadata: unknown;
};

export type ImportPreviewSummary = {
  totalProducts: number;
  matchedCount: number;
  imageCount: number;
  columnCount: number;
  folderProductCount: number;
  folderIsEmpty: boolean;
  formulasDetected: number;
  formulasWithoutCachedValue: number;
};

export type ImportPreviewRow = MappedProductRow & {
  isMatch?: boolean;
  matchedProductId?: string;
};

export type ImportPreviewResponse = {
  summary: ImportPreviewSummary;
  products: ImportPreviewRow[];
  matchedProducts: ImportPreviewRow[];
  warnings: string[];
  errors: string[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ImportReport = Record<string, unknown>;

export type ImportImageReviewItem = {
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
  status: string;
  source: string;
  matchCandidates: unknown;
  errorMessage: string | null;
  thumbnailUrl: string | null;
  fullUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImportImageReviewResponse = {
  jobId: string;
  items: ImportImageReviewItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function toImportJobDetail(job: ImportJobWithRelations): ImportJobDetail {
  const summary = job.preview?.summary as ImportPreviewSummary | undefined;

  return {
    id: job.id,
    status: job.status,
    actionType: job.actionType,
    catalogId: job.catalogId,
    folderId: job.folderId,
    targetSheetName: job.targetSheetName,
    uploadedFile: {
      id: job.uploadedFile.id,
      originalName: job.uploadedFile.originalName,
      sizeBytes: job.uploadedFile.sizeBytes,
      mimeType: job.uploadedFile.mimeType,
    },
    catalog: job.catalog,
    folder: job.folder,
    progress: (job.progress as ImportProgressDto | null) ?? null,
    errorMessage: job.errorMessage,
    summary: summary ?? null,
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export function toImportSheetItems(job: ImportJobWithRelations): ImportSheetItem[] {
  return job.sheets.map((sheet) => ({
    id: sheet.id,
    sheetName: sheet.sheetName,
    classification: sheet.classification,
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    detectedHeaders: sheet.detectedHeaders,
    metadata: sheet.metadata,
  }));
}
