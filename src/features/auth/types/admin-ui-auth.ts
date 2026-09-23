import type { User, UserRole } from "@/generated/prisma/client";
import { hasPermission } from "@/shared/auth/permissions";

/**
 * UI authorization derived from session role permissions.
 *
 * Not to be confused with column metadata `isAdminEditable` (domain field on
 * catalog/price columns), which controls column configuration — not session auth.
 */
export type AdminUiAuth = {
  role: UserRole;
  canEdit: boolean;
  isAdmin: boolean;
  currentUserId: string;
  canCreateClient: boolean;
  canUpdateClient: boolean;
  canDeleteClient: boolean;
  canCreateInvoice: boolean;
  canUpdateInvoice: boolean;
  canDeleteInvoice: boolean;
  canManageCategories: boolean;
  canManageMovements: boolean;
  canUpdateMovements: boolean;
  canUpdateSettings: boolean;
  canManageFiles: boolean;
  canManageUsers: boolean;
};

export function toAdminUiAuth(
  profile: Pick<User, "id" | "role">,
): AdminUiAuth {
  const { role } = profile;
  const isAdmin = role === "ADMINISTRADOR";

  return {
    role,
    canEdit: hasPermission(role, "catalogs.update"),
    isAdmin,
    currentUserId: profile.id,
    canCreateClient: hasPermission(role, "clients.create"),
    canUpdateClient: hasPermission(role, "clients.update"),
    canDeleteClient: hasPermission(role, "clients.delete"),
    canCreateInvoice: hasPermission(role, "invoices.create"),
    canUpdateInvoice: hasPermission(role, "invoices.update"),
    canDeleteInvoice: hasPermission(role, "invoices.delete"),
    canManageCategories: hasPermission(role, "categories.update"),
    canManageMovements: hasPermission(role, "movements.create"),
    canUpdateMovements: hasPermission(role, "movements.update"),
    canUpdateSettings: hasPermission(role, "settings.update"),
    canManageFiles: hasPermission(role, "files.manage"),
    canManageUsers: hasPermission(role, "users.manage"),
  };
}
