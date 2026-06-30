import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_REMEMBERED_EMAIL_KEY,
  clearRememberedEmail,
  readRememberedEmail,
  writeRememberedEmail,
} from "@/features/auth/lib/login-credentials.storage";

describe("login-credentials.storage", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    const localStorageMock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("window", { localStorage: localStorageMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve null cuando no hay email guardado", () => {
    expect(readRememberedEmail()).toBeNull();
  });

  it("guarda y lee el email recortado", () => {
    writeRememberedEmail("  usuario@example.com  ");

    expect(storage.get(LOGIN_REMEMBERED_EMAIL_KEY)).toBe("usuario@example.com");
    expect(readRememberedEmail()).toBe("usuario@example.com");
  });

  it("no guarda un email vacío", () => {
    writeRememberedEmail("   ");

    expect(storage.has(LOGIN_REMEMBERED_EMAIL_KEY)).toBe(false);
  });

  it("elimina el email guardado", () => {
    writeRememberedEmail("usuario@example.com");
    clearRememberedEmail();

    expect(readRememberedEmail()).toBeNull();
  });
});
