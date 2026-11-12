import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import type { LibroIvaIssuedSummary } from "@/features/billing/utils/libro-iva";

/** JSON contract of GET /api/admin/billing/libro-iva/archives. */
export type LibroIvaArchiveFormat = "PDF" | "XLSX";

export type LibroIvaArchiveSummary = {
  id: string;
  environment: BillingFiscalEnvironment;
  bookKind: "MONTHLY";
  year: number;
  month: number;
  format: LibroIvaArchiveFormat;
  fileName: string;
  sizeBytes: number;
  fileSha256: string;
  fiscalDataSha256: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  generatedBy: { id: string; name: string };
  fiscalSourceChanged: boolean | null;
  issued: LibroIvaIssuedSummary | null;
};

/** JSON contract of GET /api/admin/billing/libro-iva/archives/{id}. */
export type LibroIvaArchiveDetail = LibroIvaArchiveSummary & {
  filePresent: boolean | null;
};

export type LibroIvaArchiveListResponse = {
  archives: LibroIvaArchiveSummary[];
};

export type LibroIvaArchiveDetailResponse = {
  archive: LibroIvaArchiveDetail;
};

/** JSON contract of GET /api/admin/billing/libro-iva/archives/presence. */
export type LibroIvaArchivePresenceFile = {
  id: string;
  filePresent: boolean | null;
};

export type LibroIvaArchivePresenceResponse = {
  files: LibroIvaArchivePresenceFile[];
};
