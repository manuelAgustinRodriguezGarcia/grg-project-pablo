import "server-only";

export type ArcaTicketCacheErrorCode =
  | "ARCA_TICKET_ALREADY_ACTIVE_NOT_CACHED"
  | "ARCA_TICKET_CACHE_CORRUPT"
  | "ENCRYPTION_VERSION_UNSUPPORTED";

export class ArcaTicketCacheError extends Error {
  readonly code: ArcaTicketCacheErrorCode;

  constructor(message: string, code: ArcaTicketCacheErrorCode) {
    super(message);
    this.name = "ArcaTicketCacheError";
    this.code = code;
  }
}
