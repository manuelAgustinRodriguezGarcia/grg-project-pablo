export type PriceItemErrorCode =
  | "PRICE_LIST_NOT_FOUND"
  | "PRICE_ITEM_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "COLUMN_NOT_EDITABLE";

export class PriceItemError extends Error {
  readonly code: PriceItemErrorCode;

  constructor(message: string, code: PriceItemErrorCode) {
    super(message);
    this.name = "PriceItemError";
    this.code = code;
  }
}
