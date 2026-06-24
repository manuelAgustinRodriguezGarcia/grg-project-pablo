export type ColumnHelpErrorCode =
  | "COLUMN_NOT_FOUND"
  | "FOLDER_NOT_FOUND"
  | "CATALOG_NOT_FOUND"
  | "HELP_IMAGE_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "FORBIDDEN";

export class ColumnHelpError extends Error {
  readonly code: ColumnHelpErrorCode;

  constructor(message: string, code: ColumnHelpErrorCode) {
    super(message);
    this.name = "ColumnHelpError";
    this.code = code;
  }
}
