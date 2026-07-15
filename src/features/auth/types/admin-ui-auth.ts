import type { User, UserRole } from "@/generated/prisma/client";

/**
 * UI authorization derived from session role.
 *
 * Not to be confused with column metadata `isAdminEditable` (domain field on
 * catalog/price columns), which controls column configuration — not session auth.
 */
export type AdminUiAuth = {
  role: UserRole;
  /**
   * ADMIN only — content mutations and destructive actions.
   * Aligns with `requireEditor()` / `requireAdmin()` on the backend.
   * USUARIO is view-only (browse, search, filter).
   */
  canEdit: boolean;
  /** ADMIN only — aligns with `requireAdmin()` on the backend. */
  isAdmin: boolean;
  currentUserId: string;
};

export function toAdminUiAuth(
  profile: Pick<User, "id" | "role">,
): AdminUiAuth {
  const isAdmin = profile.role === "ADMIN";

  return {
    role: profile.role,
    canEdit: isAdmin,
    isAdmin,
    currentUserId: profile.id,
  };
}
