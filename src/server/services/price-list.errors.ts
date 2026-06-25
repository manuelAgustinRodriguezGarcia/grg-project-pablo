export type PriceListErrorCode =
  | "PRICE_LIST_NOT_FOUND"
  | "PRICE_LIST_DUPLICATE_NAME"
  | "VALIDATION_ERROR"
  | "INVALID_STATUS";

export class PriceListError extends Error {
  readonly code: PriceListErrorCode;

  constructor(message: string, code: PriceListErrorCode) {
    super(message);
    this.name = "PriceListError";
    this.code = code;
  }
}
