/** Rutas públicas de autenticación (no requieren sesión). */
export const AUTH_PUBLIC_PATHS = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/callback",
] as const;

export const AUTH_LOGIN_PATH = "/auth/login";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_RESET_PASSWORD_PATH = "/auth/reset-password";

/** Prefijos protegidos por middleware (requieren sesión Supabase válida). */
export const PROTECTED_PATH_PREFIXES = ["/admin", "/api/admin"] as const;

/** Señal para que el cliente limpie datos offline al cerrar sesión (Fase 9). */
export const OFFLINE_DATA_CLEAR_SIGNAL = "grg:offline:clear" as const;
