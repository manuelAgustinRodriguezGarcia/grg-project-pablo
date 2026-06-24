export type ProductErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "FOLDER_NOT_FOUND"
  | "CATALOG_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "COLUMN_NOT_EDITABLE"
  | "DUPLICATE_CODE";

export class ProductError extends Error {
  readonly code: ProductErrorCode;

  constructor(message: string, code: ProductErrorCode) {
    super(message);
    this.name = "ProductError";
    this.code = code;
  }
}
