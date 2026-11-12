export type BillingLibroIvaArchiveErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "ARCHIVE_FILE_MISSING";

export class BillingLibroIvaArchiveError extends Error {
  readonly code: BillingLibroIvaArchiveErrorCode;

  constructor(message: string, code: BillingLibroIvaArchiveErrorCode) {
    super(message);
    this.name = "BillingLibroIvaArchiveError";
    this.code = code;
  }
}
