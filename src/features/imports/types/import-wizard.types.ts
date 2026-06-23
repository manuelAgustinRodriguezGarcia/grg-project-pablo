import type { ImportActionType, ImportJobStatus } from "@/generated/prisma/client";
import type { ImportSheetItem } from "@/features/imports/types/import-job.types";

export type ImportWizardStep = "upload" | "destination" | "preview" | "result";

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
