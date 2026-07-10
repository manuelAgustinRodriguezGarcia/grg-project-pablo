import type { UserStatus } from "@/generated/prisma/client";
import styles from "@/features/users/styles/UsersManager.module.scss";

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
};

type UserStatusBadgeProps = {
  status: UserStatus;
};

export function UserStatusBadge({ status }: UserStatusBadgeProps) {
  const toneClass =
    status === "ACTIVE" ? styles.statusBadgeActive : styles.statusBadgeInactive;

  return (
    <span className={`${styles.statusBadge} ${toneClass}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
