import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/server/auth/rate-limit";

describe("rate-limit", () => {
  it("permite solicitudes dentro del límite", () => {
    const key = `test-${Date.now()}-allowed`;

    expect(checkRateLimit(key, 2, 60_000)).toEqual({ allowed: true });
    expect(checkRateLimit(key, 2, 60_000)).toEqual({ allowed: true });
  });

  it("bloquea solicitudes que exceden el límite", () => {
    const key = `test-${Date.now()}-blocked`;

    expect(checkRateLimit(key, 1, 60_000)).toEqual({ allowed: true });
    const blocked = checkRateLimit(key, 1, 60_000);

    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});
