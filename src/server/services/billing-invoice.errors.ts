export type BillingInvoiceErrorCode =
  | "VALIDATION_ERROR"
  | "BILLING_CLIENT_NOT_FOUND"
  | "BILLING_RUBRO_NOT_FOUND"
  | "BILLING_RUBRO_INACTIVE"
  | "GENERIC_CLIENT_LIMIT_EXCEEDED"
  | "ENVIRONMENT_NOT_SUPPORTED"
  | "LEGACY_NOTES_DISABLED"
  | "LEGACY_NOTE_INVOICE_ENVIRONMENT"
  | "PRODUCTION_EMISSION_DISABLED"
  | "NOTE_PRODUCTION_EMISSION_DISABLED"
  | "ARCA_PRODUCTION_CONFIGURATION_INCOMPLETE"
  | "ARCA_CONFIGURATION_ERROR"
  | "ARCA_INVOICE_REJECTED"
  | "ARCA_EMISSION_STATUS_UNCERTAIN"
  | "ARCA_APPROVED_LOCAL_PERSISTENCE_PENDING"
  | "ARCA_EMISSION_FAILED_PRE_SEND"
  | "ARCA_IDEMPOTENCY_CONFLICT"
  | "ARCA_RETRY_FISCAL_DATE_CHANGED"
  | "ARCA_QR_DATA_INCOMPLETE"
  | "NUMBER_GENERATION_FAILED"
  | "BILLING_INVOICE_NOT_FOUND"
  | "BILLING_NOTE_NOT_FOUND"
  | "NOTE_FISCAL_ISSUER_MISSING"
  | "BILLING_RECEIPT_NOT_FOUND"
  | "SALDO_CHANGED";

export const ARCA_RETRY_FISCAL_DATE_CHANGED_MESSAGE =
  "Este intento pertenece a una fecha fiscal anterior y no puede reanudarse automáticamente. Volvé a cargar el formulario para iniciar una nueva operación.";

export class BillingInvoiceError extends Error {
  readonly code: BillingInvoiceErrorCode;

  constructor(message: string, code: BillingInvoiceErrorCode) {
    super(message);
    this.name = "BillingInvoiceError";
    this.code = code;
  }
}
