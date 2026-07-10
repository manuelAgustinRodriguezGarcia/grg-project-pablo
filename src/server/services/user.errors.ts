export type UserErrorCode =
  | "EMAIL_ALREADY_EXISTS"
  | "USER_NOT_FOUND"
  | "CANNOT_DEACTIVATE_SELF"
  | "CANNOT_CHANGE_OWN_ROLE"
  | "AUTH_PROVIDER_ERROR"
  | "VALIDATION_ERROR";

export class UserError extends Error {
  readonly code: UserErrorCode;

  constructor(message: string, code: UserErrorCode) {
    super(message);
    this.name = "UserError";
    this.code = code;
  }
}
