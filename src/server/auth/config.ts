import type { UserRole } from "@/generated/prisma/client";
import { hasPermission } from "@/shared/auth/permissions";

export const AUTH_PUBLIC_PATHS = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/callback",
] as const;

export const AUTH_LOGIN_PATH = "/auth/login";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_RESET_PASSWORD_PATH = "/auth/reset-password";

export const ADMIN_HOME_PATH = "/admin";

export const ADMIN_DASHBOARD_PATH = "/admin/inicio";

export const USER_HOME_PATH = "/admin/catalogos";

export function getRoleHomePath(role: UserRole): string {
  if (hasPermission(role, "dashboard.read")) {
    return ADMIN_DASHBOARD_PATH;
  }
  return USER_HOME_PATH;
}

export function isAdminEntryPath(pathname: string): boolean {
  return pathname === ADMIN_HOME_PATH || pathname === `${ADMIN_HOME_PATH}/`;
}

export const PROTECTED_PATH_PREFIXES = ["/admin", "/api/admin"] as const;

export const OFFLINE_DATA_CLEAR_SIGNAL = "grg:offline:clear" as const;
