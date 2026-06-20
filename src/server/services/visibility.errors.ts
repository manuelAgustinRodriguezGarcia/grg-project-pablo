export type VisibilityErrorCode =
  | "CATALOG_NOT_VISIBLE"
  | "FOLDER_NOT_VISIBLE"
  | "COLUMN_NOT_VISIBLE";

export class VisibilityError extends Error {
  readonly code: VisibilityErrorCode;

  constructor(message: string, code: VisibilityErrorCode) {
    super(message);
    this.name = "VisibilityError";
    this.code = code;
  }
}
