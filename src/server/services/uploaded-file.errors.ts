export type UploadedFileErrorCode =
  | "FILE_NOT_FOUND"
  | "ACTIVE_JOB_EXISTS"
  | "CONFIRMATION_REQUIRED"
  | "VALIDATION_ERROR";

export class UploadedFileError extends Error {
  readonly code: UploadedFileErrorCode;

  constructor(message: string, code: UploadedFileErrorCode) {
    super(message);
    this.name = "UploadedFileError";
    this.code = code;
  }
}
