export type CatalogErrorCode =
  | "CATALOG_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INVALID_STATUS";

export class CatalogError extends Error {
  readonly code: CatalogErrorCode;

  constructor(message: string, code: CatalogErrorCode) {
    super(message);
    this.name = "CatalogError";
    this.code = code;
  }
}
