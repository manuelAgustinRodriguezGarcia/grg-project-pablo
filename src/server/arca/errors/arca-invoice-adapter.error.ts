import "server-only";

export type ArcaInvoiceAdapterErrorCode =
  | "ARCA_INVOICE_TYPE_MISMATCH"
  | "ARCA_DOCUMENT_REQUIRED"
  | "ARCA_UNSUPPORTED_VAT_RATE";

export class ArcaInvoiceAdapterError extends Error {
  readonly code: ArcaInvoiceAdapterErrorCode;

  constructor(message: string, code: ArcaInvoiceAdapterErrorCode) {
    super(message);
    this.name = "ArcaInvoiceAdapterError";
    this.code = code;
  }
}
