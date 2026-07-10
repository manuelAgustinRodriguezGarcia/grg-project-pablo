import type { UserRole } from "@/generated/prisma/client";
import { USER_ROLE_LABELS } from "@/features/users/types/user.types";
import styles from "@/features/users/styles/UsersManager.module.scss";

type UserRoleBadgeProps = {
  role: UserRole;
};

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  const toneClass =
    role === "ADMIN"
      ? styles.roleBadgeAdmin
      : role === "USUARIO"
        ? styles.roleBadgeEditor
        : styles.roleBadgeViewer;

  return (
    <span className={`${styles.roleBadge} ${toneClass}`}>
      {USER_ROLE_LABELS[role]}
    </span>
  );
}
