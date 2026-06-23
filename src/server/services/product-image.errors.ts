export type ProductImageErrorCode =
  | "IMAGE_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "IMPORT_NOT_FOUND"
  | "INVALID_STATE"
  | "VALIDATION_ERROR"
  | "FORBIDDEN";

export class ProductImageError extends Error {
  readonly code: ProductImageErrorCode;

  constructor(message: string, code: ProductImageErrorCode) {
    super(message);
    this.name = "ProductImageError";
    this.code = code;
  }
}
