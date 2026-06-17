export {
  AUTH_CALLBACK_PATH,
  AUTH_LOGIN_PATH,
  AUTH_PUBLIC_PATHS,
  AUTH_RESET_PASSWORD_PATH,
  OFFLINE_DATA_CLEAR_SIGNAL,
  PROTECTED_PATH_PREFIXES,
} from "./config";
export { getAppOrigin, getSupabasePublicEnv } from "./env";
export { AuthError, AuthForbiddenError } from "./errors";
export type { AuthErrorCode } from "./errors";
export {
  requireAuth,
  requireAuthOrRedirect,
  requireRole,
  requireRoleOrRedirect,
} from "./guards";
export { authService, AuthService } from "./auth.service";
export type {
  RequestPasswordResetInput,
  SignInInput,
  UpdatePasswordInput,
} from "./auth.service";
export { getSessionContext, getSupabaseUser, isAuthenticatedContext } from "./session";
export { createSupabaseBrowserClient } from "./supabase-browser";
export { updateSession } from "./supabase-middleware";
export { createSupabaseServerClient } from "./supabase-server";
export type {
  AuthActionResult,
  AuthenticatedUser,
  SignOutResult,
  UserRole,
} from "./types";
