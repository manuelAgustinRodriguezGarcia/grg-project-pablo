import "server-only";

export class ArcaQrError extends Error {
  readonly code = "ARCA_QR_DATA_INCOMPLETE";

  constructor(message: string) {
    super(message);
    this.name = "ArcaQrError";
  }
}
