import type { UserRole } from "@/generated/prisma/client";
import {
  USER_ROLE_LABELS,
  USER_ROLE_TONES,
} from "@/features/users/types/user.types";
import {
  getRoleIcon,
  ICON_STROKE,
} from "@/features/users/utils/role-presentation";
import styles from "@/features/users/styles/UsersManager.module.scss";

type UserRoleBadgeProps = {
  role: UserRole;
};

const TONE_CLASS: Record<
  (typeof USER_ROLE_TONES)[UserRole],
  string
> = {
  visitor: styles.roleBadgeVisitor,
  seller: styles.roleBadgeSeller,
  advancedVisitor: styles.roleBadgeAdvancedVisitor,
  admin: styles.roleBadgeAdmin,
};

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  const toneClass = TONE_CLASS[USER_ROLE_TONES[role]];
  const Icon = getRoleIcon(role);
  const isAdmin = role === "ADMINISTRADOR";

  return (
    <span className={`${styles.roleBadge} ${toneClass}`}>
      <Icon
        className={`${styles.roleBadgeIcon} ${isAdmin ? styles.roleBadgeIconAdmin : ""}`}
        strokeWidth={ICON_STROKE}
        aria-hidden
      />
      {USER_ROLE_LABELS[role]}
    </span>
  );
}
