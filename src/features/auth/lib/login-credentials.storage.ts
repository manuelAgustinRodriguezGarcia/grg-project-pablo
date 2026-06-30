export const LOGIN_REMEMBERED_EMAIL_KEY = "grg:login:remembered-email";

export function readRememberedEmail(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(LOGIN_REMEMBERED_EMAIL_KEY);
  if (!stored) {
    return null;
  }

  const trimmed = stored.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function writeRememberedEmail(email: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return;
  }

  window.localStorage.setItem(LOGIN_REMEMBERED_EMAIL_KEY, trimmed);
}

export function clearRememberedEmail(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LOGIN_REMEMBERED_EMAIL_KEY);
}
