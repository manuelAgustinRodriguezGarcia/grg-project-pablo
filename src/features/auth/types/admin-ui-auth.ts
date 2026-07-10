import type { User, UserRole } from "@/generated/prisma/client";

/**
 * UI authorization derived from session role.
 *
 * Not to be confused with column metadata `isAdminEditable` (domain field on
 * catalog/price columns), which controls column configuration — not session auth.
 */
export type AdminUiAuth = {
  role: UserRole;
  /** ADMIN or USUARIO — aligns with `requireEditor()` on the backend. */
  canEdit: boolean;
  /** ADMIN only — aligns with `requireAdmin()` on the backend. */
  isAdmin: boolean;
  currentUserId: string;
};

function hasEditorRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "USUARIO";
}

export function toAdminUiAuth(
  profile: Pick<User, "id" | "role">,
): AdminUiAuth {
  return {
    role: profile.role,
    canEdit: hasEditorRole(profile.role),
    isAdmin: profile.role === "ADMIN",
    currentUserId: profile.id,
  };
}
