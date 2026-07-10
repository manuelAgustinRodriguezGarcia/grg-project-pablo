"use server";

import { AuthError } from "@/server/auth";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";
import { RolePermissionError } from "@/server/services/role-permission.errors";
import { rolePermissionService } from "@/server/services/role-permission.service";
import {
  listRolePermissionsSchema,
  updateRolePermissionSchema,
} from "@/features/permissions/schemas/permission.schemas";
import type {
  PermissionActionResult,
  RolePermissionItem,
} from "@/features/permissions/types/permission.types";
import { toRolePermissionItem } from "@/features/permissions/types/permission.types";

function toActionError(error: unknown): PermissionActionResult<never> {
  if (error instanceof RolePermissionError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof Error) {
    return { success: false, error: getSafeClientMessage(error) };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function listRolePermissionsAction(
  input: unknown = { role: "USUARIO" },
): Promise<PermissionActionResult<RolePermissionItem[]>> {
  const parsed = listRolePermissionsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const rows = await rolePermissionService.listForRole(parsed.data.role);
    return { success: true, data: rows.map(toRolePermissionItem) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateRolePermissionAction(
  input: unknown,
): Promise<PermissionActionResult<RolePermissionItem>> {
  const parsed = updateRolePermissionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const row = await rolePermissionService.setEnabled(
      parsed.data.id,
      parsed.data.enabled,
    );
    return { success: true, data: toRolePermissionItem(row) };
  } catch (error) {
    return toActionError(error);
  }
}
