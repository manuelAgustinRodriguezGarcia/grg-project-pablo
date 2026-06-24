export type SearchErrorCode =
  | "VALIDATION_ERROR"
  | "CATALOG_NOT_FOUND"
  | "FOLDER_NOT_FOUND";

export class SearchError extends Error {
  constructor(
    message: string,
    public readonly code: SearchErrorCode,
  ) {
    super(message);
    this.name = "SearchError";
  }
}
