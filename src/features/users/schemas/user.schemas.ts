import { z } from "zod";

export const userRoleSchema = z.enum(["ADMIN", "USUARIO"]);

export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "El correo es obligatorio.")
    .email("Introduce un correo válido."),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(72, "La contraseña no puede superar 72 caracteres."),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(120, "El nombre no puede superar 120 caracteres."),
  role: userRoleSchema,
});

export const updateUserSchema = z
  .object({
    id: z.string().uuid("Identificador de usuario inválido."),
    name: z
      .string()
      .trim()
      .min(1, "El nombre no puede estar vacío.")
      .max(120, "El nombre no puede superar 120 caracteres.")
      .optional(),
    email: z
      .string()
      .trim()
      .min(1, "El correo es obligatorio.")
      .email("Introduce un correo válido.")
      .optional(),
    role: userRoleSchema.optional(),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
      .max(72, "La contraseña no puede superar 72 caracteres.")
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.role !== undefined ||
      data.password !== undefined,
    {
      message: "Debes indicar al menos un campo para actualizar.",
      path: ["name"],
    },
  );

export const userIdSchema = z.object({
  userId: z.string().uuid("Identificador de usuario inválido."),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserIdInput = z.infer<typeof userIdSchema>;
