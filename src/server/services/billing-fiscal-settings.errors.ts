export type BillingFiscalSettingsErrorCode = "VALIDATION_ERROR";

export class BillingFiscalSettingsError extends Error {
  readonly code: BillingFiscalSettingsErrorCode;

  constructor(message: string, code: BillingFiscalSettingsErrorCode) {
    super(message);
    this.name = "BillingFiscalSettingsError";
    this.code = code;
  }
}
