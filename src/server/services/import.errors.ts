export type ImportErrorCode =
  | "IMPORT_NOT_FOUND"
  | "INVALID_STATE"
  | "INVALID_FILE"
  | "FOLDER_NOT_EMPTY"
  | "CONFIRMATION_REQUIRED"
  | "ANALYSIS_FAILED"
  | "PREVIEW_FAILED"
  | "PUBLISH_FAILED"
  | "IMAGE_PROCESSING_INTERRUPTED"
  | "SHEET_NOT_IMPORTABLE"
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "UNAUTHENTICATED";

export class ImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(message: string, code: ImportErrorCode) {
    super(message);
    this.name = "ImportError";
    this.code = code;
  }
}
