export type BillingRubroErrorCode =
  | "BILLING_RUBRO_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "DUPLICATE_NAME"
  | "DUPLICATE_CODE"
  | "CODE_GENERATION_FAILED";

export class BillingRubroError extends Error {
  readonly code: BillingRubroErrorCode;

  constructor(message: string, code: BillingRubroErrorCode) {
    super(message);
    this.name = "BillingRubroError";
    this.code = code;
  }
}
