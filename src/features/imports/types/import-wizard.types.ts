import type { ImportActionType, ImportJobStatus } from "@/generated/prisma/client";
import type { ImportSheetItem } from "@/features/imports/types/import-job.types";

export type ImportWizardStep =
  | "upload"
  | "destination"
  | "columns"
  | "preview"
  | "imageReview"
  | "result";

export type ImportSheetsResponse = {
  jobId: string;
  sheets: ImportSheetItem[];
};

/** Espejo de `ImportReport` (`catalog-import.service`) persistido en `ImportJob.resultados`. */
export type ImportReportData = {
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
  imagesExtracted?: number;
  imagesAssociated: number;
  imagesPendingReview: number;
  imagesRejected?: number;
  imagesAmbiguous?: number;
  embeddedImagesDetected: number;
  embeddedImagesAssociated: number;
  embeddedImagesPendingReview: number;
  embeddedImagesRejected: number;
  rowsWithEmbeddedImages: number;
  productsWithEmbeddedImages: number;
  productsWithMultipleEmbeddedImages: number;
  columnsDetected: number;
  columnsCreated: number;
  errors: string[];
  warnings: string[];
  actionApplied: ImportActionType | null;
};

export type ImportReportResponse = {
  jobId: string;
  status: ImportJobStatus;
  report: ImportReportData | null;
  errorMessage: string | null;
  finishedAt: string | null;
};
