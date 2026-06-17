export type AuthErrorCode =
  | "UNAUTHENTICATED"
  | "USER_INACTIVE"
  | "FORBIDDEN"
  | "INVALID_CREDENTIALS"
  | "PROFILE_NOT_FOUND"
  | "AUTH_PROVIDER_ERROR";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(message: string, code: AuthErrorCode) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export class AuthForbiddenError extends AuthError {
  constructor(message = "No tienes permisos para realizar esta acción.") {
    super(message, "FORBIDDEN");
    this.name = "AuthForbiddenError";
  }
}
