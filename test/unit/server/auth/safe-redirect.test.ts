import { describe, expect, it } from "vitest";
import { ADMIN_HOME_PATH } from "@/server/auth/config";
import {
  isSafeRedirectPath,
  resolveSafeRedirectPath,
} from "@/server/auth/safe-redirect";

describe("safe-redirect", () => {
  it("acepta rutas internas válidas", () => {
    expect(isSafeRedirectPath("/admin")).toBe(true);
    expect(isSafeRedirectPath("/admin/imports")).toBe(true);
    expect(resolveSafeRedirectPath("/admin/catalogs")).toBe("/admin/catalogs");
  });

  it("rechaza open redirects con doble slash", () => {
    expect(isSafeRedirectPath("//evil.com")).toBe(false);
    expect(isSafeRedirectPath("//evil.com/phish")).toBe(false);
    expect(resolveSafeRedirectPath("//evil.com")).toBe(ADMIN_HOME_PATH);
  });

  it("rechaza URLs absolutas y rutas con backslash", () => {
    expect(isSafeRedirectPath("https://evil.com")).toBe(false);
    expect(isSafeRedirectPath("\\evil.com")).toBe(false);
    expect(resolveSafeRedirectPath("https://evil.com")).toBe(ADMIN_HOME_PATH);
  });

  it("usa fallback para valores vacíos o inválidos", () => {
    expect(resolveSafeRedirectPath(null)).toBe(ADMIN_HOME_PATH);
    expect(resolveSafeRedirectPath("")).toBe(ADMIN_HOME_PATH);
    expect(resolveSafeRedirectPath("   ")).toBe(ADMIN_HOME_PATH);
  });
});
