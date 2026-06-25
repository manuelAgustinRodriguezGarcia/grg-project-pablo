export type OfflineSyncErrorCode =
  | "VALIDATION_ERROR"
  | "CATALOG_NOT_FOUND"
  | "FOLDER_NOT_FOUND"
  | "PRICE_LIST_NOT_FOUND";

export class OfflineSyncError extends Error {
  readonly code: OfflineSyncErrorCode;

  constructor(message: string, code: OfflineSyncErrorCode) {
    super(message);
    this.name = "OfflineSyncError";
    this.code = code;
  }
}
