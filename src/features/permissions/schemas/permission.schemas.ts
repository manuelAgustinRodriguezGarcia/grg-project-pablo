import { z } from "zod";

export const rolePermissionRoleSchema = z.enum(["ADMIN", "USUARIO"]);

export const listRolePermissionsSchema = z.object({
  role: rolePermissionRoleSchema.default("USUARIO"),
});

export const updateRolePermissionSchema = z.object({
  id: z.string().min(1, "Identificador de permiso inválido."),
  enabled: z.boolean(),
});

export type ListRolePermissionsInput = z.infer<typeof listRolePermissionsSchema>;
export type UpdateRolePermissionInput = z.infer<typeof updateRolePermissionSchema>;
