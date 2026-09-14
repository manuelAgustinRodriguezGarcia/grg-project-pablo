export type BillingInvoiceErrorCode =
  | "VALIDATION_ERROR"
  | "BILLING_CLIENT_NOT_FOUND"
  | "BILLING_RUBRO_NOT_FOUND"
  | "BILLING_RUBRO_INACTIVE"
  | "GENERIC_CLIENT_LIMIT_EXCEEDED"
  | "ENVIRONMENT_NOT_SUPPORTED"
  | "NUMBER_GENERATION_FAILED"
  | "BILLING_INVOICE_NOT_FOUND"
  | "BILLING_NOTE_NOT_FOUND"
  | "BILLING_RECEIPT_NOT_FOUND"
  | "SALDO_CHANGED";

export class BillingInvoiceError extends Error {
  readonly code: BillingInvoiceErrorCode;

  constructor(message: string, code: BillingInvoiceErrorCode) {
    super(message);
    this.name = "BillingInvoiceError";
    this.code = code;
  }
}
