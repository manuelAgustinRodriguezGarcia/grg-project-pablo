import "server-only";

export type ArcaEmissionErrorCode =
  | "ARCA_IDEMPOTENCY_CONFLICT"
  | "ARCA_AMBIGUOUS_VOUCHER_MISMATCH"
  | "ARCA_AMBIGUOUS_VOUCHER_NOT_FOUND"
  | "ARCA_EMISSION_NOT_READY_FOR_PERSISTENCE"
  | "ARCA_APPROVED_EMISSION_INCOMPLETE"
  | "ARCA_EMISSION_SNAPSHOT_MISMATCH";

export class ArcaEmissionError extends Error {
  readonly code: ArcaEmissionErrorCode;

  constructor(message: string, code: ArcaEmissionErrorCode) {
    super(message);
    this.name = "ArcaEmissionError";
    this.code = code;
  }
}
