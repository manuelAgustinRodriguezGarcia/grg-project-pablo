import { describe, expect, it } from "vitest";
import {
  createUserSchema,
  updateUserSchema,
  userIdSchema,
} from "@/features/users/schemas/user.schemas";
import { ADMIN_USER_ID } from "../../../helpers/fixtures/user.fixture";

describe("createUserSchema", () => {
  it("acepta un usuario válido", () => {
    const result = createUserSchema.safeParse({
      email: "nuevo@example.com",
      password: "password123",
      name: "Nuevo Usuario",
      role: "USUARIO",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza correo inválido", () => {
    const result = createUserSchema.safeParse({
      email: "correo-invalido",
      password: "password123",
      name: "Nuevo Usuario",
      role: "USUARIO",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza contraseña corta", () => {
    const result = createUserSchema.safeParse({
      email: "nuevo@example.com",
      password: "1234567",
      name: "Nuevo Usuario",
      role: "USUARIO",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza nombre vacío", () => {
    const result = createUserSchema.safeParse({
      email: "nuevo@example.com",
      password: "password123",
      name: "",
      role: "USUARIO",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("acepta actualización parcial de nombre", () => {
    const result = updateUserSchema.safeParse({
      id: ADMIN_USER_ID,
      name: "Nombre actualizado",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza actualización sin nombre ni rol", () => {
    const result = updateUserSchema.safeParse({
      id: ADMIN_USER_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rechaza id inválido", () => {
    const result = updateUserSchema.safeParse({
      id: "no-es-uuid",
      name: "Nombre",
    });

    expect(result.success).toBe(false);
  });
});

describe("userIdSchema", () => {
  it("acepta un UUID válido", () => {
    const result = userIdSchema.safeParse({ userId: ADMIN_USER_ID });

    expect(result.success).toBe(true);
  });
});
