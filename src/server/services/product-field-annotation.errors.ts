export class ProductFieldAnnotationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "ProductFieldAnnotationError";
    this.code = code;
  }
}
