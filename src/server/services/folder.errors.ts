export type FolderErrorCode =
  | "FOLDER_NOT_FOUND"
  | "CATALOG_NOT_FOUND"
  | "FOLDER_DUPLICATE_NAME"
  | "VALIDATION_ERROR"
  | "INVALID_STATUS";

export class FolderError extends Error {
  readonly code: FolderErrorCode;

  constructor(message: string, code: FolderErrorCode) {
    super(message);
    this.name = "FolderError";
    this.code = code;
  }
}
