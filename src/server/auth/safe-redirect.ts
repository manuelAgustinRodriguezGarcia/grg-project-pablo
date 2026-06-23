import { ADMIN_HOME_PATH } from "./config";

/**
 * Valida rutas de redirección internas para evitar open redirects.
 * Acepta solo paths relativos que empiezan con "/" y no con "//".
 */
export function isSafeRedirectPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return false;
  }

  if (trimmed.includes("\\") || trimmed.includes("\0")) {
    return false;
  }

  return true;
}

export function resolveSafeRedirectPath(
  value: string | null | undefined,
  fallback = ADMIN_HOME_PATH,
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return isSafeRedirectPath(trimmed) ? trimmed : fallback;
}
