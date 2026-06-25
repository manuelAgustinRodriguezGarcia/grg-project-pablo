export type PriceColumnConfigErrorCode =
  | "PRICE_LIST_NOT_FOUND"
  | "PRICE_COLUMN_NOT_FOUND"
  | "COLUMN_PRIMARY_CODE_CONFLICT"
  | "COLUMN_DUPLICATE_KEY"
  | "VALIDATION_ERROR";

export class PriceColumnConfigError extends Error {
  readonly code: PriceColumnConfigErrorCode;

  constructor(message: string, code: PriceColumnConfigErrorCode) {
    super(message);
    this.name = "PriceColumnConfigError";
    this.code = code;
  }
}
