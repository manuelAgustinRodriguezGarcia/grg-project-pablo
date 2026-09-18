export type BillingClientErrorCode =
  | "BILLING_CLIENT_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INVALID_CUIT"
  | "INVALID_DNI"
  | "INVALID_IVA_CONDITION"
  | "CODE_GENERATION_FAILED"
  | "DUPLICATE_CODE"
  | "DUPLICATE_CUIT"
  | "DUPLICATE_DNI"
  | "CLIENT_HAS_HISTORY";

export class BillingClientError extends Error {
  readonly code: BillingClientErrorCode;

  constructor(message: string, code: BillingClientErrorCode) {
    super(message);
    this.name = "BillingClientError";
    this.code = code;
  }
}
