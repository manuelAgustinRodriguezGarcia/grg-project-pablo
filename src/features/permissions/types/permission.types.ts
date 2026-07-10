import type { RolePermissionWithPermission } from "@/server/repositories/permission.repository";

export type PermissionActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type RolePermissionItem = {
  id: string;
  role: RolePermissionWithPermission["role"];
  enabled: boolean;
  permission: {
    id: string;
    key: string;
    label: string;
    description: string | null;
  };
};

export function toRolePermissionItem(
  row: RolePermissionWithPermission,
): RolePermissionItem {
  return {
    id: row.id,
    role: row.role,
    enabled: row.enabled,
    permission: {
      id: row.permission.id,
      key: row.permission.key,
      label: row.permission.label,
      description: row.permission.description,
    },
  };
}
