import { describe, expect, it } from "vitest";
import {
  requestPasswordResetSchema,
  signInSchema,
  updatePasswordSchema,
} from "@/features/auth/schemas/auth.schemas";

describe("signInSchema", () => {
  it("acepta credenciales válidas", () => {
    const result = signInSchema.safeParse({
      email: "admin@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza correo vacío", () => {
    const result = signInSchema.safeParse({
      email: "",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza contraseña corta", () => {
    const result = signInSchema.safeParse({
      email: "admin@example.com",
      password: "1234567",
    });

    expect(result.success).toBe(false);
  });
});

describe("requestPasswordResetSchema", () => {
  it("acepta un correo válido", () => {
    const result = requestPasswordResetSchema.safeParse({
      email: "usuario@example.com",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza correo inválido", () => {
    const result = requestPasswordResetSchema.safeParse({
      email: "no-es-correo",
    });

    expect(result.success).toBe(false);
  });
});

describe("updatePasswordSchema", () => {
  it("acepta contraseñas coincidentes", () => {
    const result = updatePasswordSchema.safeParse({
      password: "nuevaClave123",
      confirmPassword: "nuevaClave123",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza contraseñas que no coinciden", () => {
    const result = updatePasswordSchema.safeParse({
      password: "nuevaClave123",
      confirmPassword: "otraClave123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("confirmPassword"))).toBe(
        true,
      );
    }
  });
});
