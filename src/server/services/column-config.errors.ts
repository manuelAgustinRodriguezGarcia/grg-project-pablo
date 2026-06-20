export type ColumnConfigErrorCode =
  | "COLUMN_NOT_FOUND"
  | "FOLDER_NOT_FOUND"
  | "COLUMN_DUPLICATE_KEY"
  | "COLUMN_PRIMARY_CODE_CONFLICT"
  | "VALIDATION_ERROR";

export class ColumnConfigError extends Error {
  readonly code: ColumnConfigErrorCode;

  constructor(message: string, code: ColumnConfigErrorCode) {
    super(message);
    this.name = "ColumnConfigError";
    this.code = code;
  }
}
