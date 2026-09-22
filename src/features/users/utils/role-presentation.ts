import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/generated/prisma/client";
import {
  USER_ROLE_LABELS,
  USER_ROLE_TONES,
  type RoleTone,
} from "@/shared/auth/permissions";
import {
  ICON_STROKE,
  UserPlus,
  UserSearch,
  UserShield,
  UserStar,
} from "@/shared/icons";

export const ROLE_ICONS: Record<UserRole, LucideIcon> = {
  VISITANTE: UserSearch,
  VENDEDOR: UserPlus,
  VISITANTE_AVANZADO: UserStar,
  ADMINISTRADOR: UserShield,
};

export const ROLE_TONE_CSS_VARS: Record<RoleTone, string> = {
  visitor: "var(--role-visitor, #0066d9)",
  seller: "var(--role-seller, #1f9d55)",
  advancedVisitor: "var(--role-advanced-visitor, #6d28d9)",
  admin: "var(--role-admin, #b8960f)",
};

export function getRoleIcon(role: UserRole): LucideIcon {
  return ROLE_ICONS[role];
}

export function getRoleTone(role: UserRole): RoleTone {
  return USER_ROLE_TONES[role];
}

export function getRoleLabel(role: UserRole): string {
  return USER_ROLE_LABELS[role];
}

export { ICON_STROKE };
