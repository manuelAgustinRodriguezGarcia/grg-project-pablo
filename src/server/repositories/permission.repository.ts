import type { Permission, RolePermission, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type RolePermissionWithPermission = RolePermission & {
  permission: Permission;
};

export class PermissionRepository {
  async listByRole(role: UserRole): Promise<RolePermissionWithPermission[]> {
    return prisma.rolePermission.findMany({
      where: { role },
      include: { permission: true },
      orderBy: { permission: { label: "asc" } },
    });
  }

  async findRolePermissionById(
    id: string,
  ): Promise<RolePermissionWithPermission | null> {
    return prisma.rolePermission.findUnique({
      where: { id },
      include: { permission: true },
    });
  }

  async setEnabled(
    id: string,
    enabled: boolean,
  ): Promise<RolePermissionWithPermission> {
    return prisma.rolePermission.update({
      where: { id },
      data: { enabled },
      include: { permission: true },
    });
  }
}

export const permissionRepository = new PermissionRepository();
