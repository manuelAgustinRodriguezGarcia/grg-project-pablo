export type EquivalenceErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "EQUIVALENCE_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "DUPLICATE_CODE";

export class EquivalenceError extends Error {
  readonly code: EquivalenceErrorCode;

  constructor(message: string, code: EquivalenceErrorCode) {
    super(message);
    this.name = "EquivalenceError";
    this.code = code;
  }
}
