import "server-only";

export type ArcaNoteAdapterErrorCode =
  | "ARCA_ASSOCIATED_INVOICE_NOT_AUTHORIZED"
  | "ARCA_ASSOCIATED_INVOICE_WITHOUT_CAE"
  | "ARCA_ASSOCIATED_INVOICE_ENVIRONMENT"
  | "ARCA_NOTE_ENVIRONMENT_MISMATCH"
  | "ARCA_NOTE_INVOICE_TYPE_MISMATCH"
  | "ARCA_ASSOCIATED_POINT_OF_SALE_REQUIRED"
  | "ARCA_ASSOCIATED_SEQUENCE_REQUIRED"
  | "ARCA_NOTE_AMOUNT_INVALID"
  | "ARCA_NOTE_AMOUNTS_MISMATCH"
  | "ARCA_NOTE_VOUCHER_NUMBER_INVALID";

export class ArcaNoteAdapterError extends Error {
  readonly code: ArcaNoteAdapterErrorCode;

  constructor(message: string, code: ArcaNoteAdapterErrorCode) {
    super(message);
    this.name = "ArcaNoteAdapterError";
    this.code = code;
  }
}
