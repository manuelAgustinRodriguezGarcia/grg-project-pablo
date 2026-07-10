import type { User } from "@/generated/prisma/client";

export const ADMIN_USER_ID = "550e8400-e29b-41d4-a716-446655440001";
export const USUARIO_USER_ID = "550e8400-e29b-41d4-a716-446655440002";
export const VISUALIZACION_USER_ID = "550e8400-e29b-41d4-a716-446655440004";
export const TARGET_USER_ID = "550e8400-e29b-41d4-a716-446655440003";

const baseDate = new Date("2026-06-19T12:00:00.000Z");

export function createUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: TARGET_USER_ID,
    email: "usuario@example.com",
    name: "Usuario Test",
    role: "USUARIO",
    status: "ACTIVE",
    lastAccessAt: baseDate,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

export const adminUserFixture = createUserFixture({
  id: ADMIN_USER_ID,
  email: "admin@example.com",
  name: "Admin Test",
  role: "ADMIN",
});

export const usuarioUserFixture = createUserFixture({
  id: USUARIO_USER_ID,
  email: "usuario@example.com",
  name: "Usuario Test",
  role: "USUARIO",
});

export const visualizacionUserFixture = createUserFixture({
  id: VISUALIZACION_USER_ID,
  email: "visualizacion@example.com",
  name: "Visualización Test",
  role: "VISUALIZACION",
});
