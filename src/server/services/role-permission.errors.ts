export type RolePermissionErrorCode =
  | "PERMISSION_NOT_FOUND"
  | "ROLE_PERMISSION_NOT_FOUND"
  | "VALIDATION_ERROR";

export class RolePermissionError extends Error {
  readonly code: RolePermissionErrorCode;

  constructor(message: string, code: RolePermissionErrorCode) {
    super(message);
    this.name = "RolePermissionError";
    this.code = code;
  }
}
