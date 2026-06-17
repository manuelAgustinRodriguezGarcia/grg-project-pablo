export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export class StorageValidationError extends StorageError {
  constructor(message: string) {
    super(message);
    this.name = "StorageValidationError";
  }
}
