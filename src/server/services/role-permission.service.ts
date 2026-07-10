import type { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/server/auth";
import {
  permissionRepository,
  type RolePermissionWithPermission,
} from "@/server/repositories/permission.repository";
import { RolePermissionError } from "./role-permission.errors";

export class RolePermissionService {
  async listForRole(role: UserRole): Promise<RolePermissionWithPermission[]> {
    await requireRole("ADMIN");
    return permissionRepository.listByRole(role);
  }

  async setEnabled(
    rolePermissionId: string,
    enabled: boolean,
  ): Promise<RolePermissionWithPermission> {
    await requireRole("ADMIN");

    const existing =
      await permissionRepository.findRolePermissionById(rolePermissionId);

    if (!existing) {
      throw new RolePermissionError(
        "Permiso de rol no encontrado.",
        "ROLE_PERMISSION_NOT_FOUND",
      );
    }

    return permissionRepository.setEnabled(rolePermissionId, enabled);
  }
}

export const rolePermissionService = new RolePermissionService();
