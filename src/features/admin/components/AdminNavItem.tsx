import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ICON_STROKE } from "@/shared/icons";
import styles from "./AdminNavItem.module.scss";

type AdminNavItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  isCollapsed?: boolean;
  variant?: "sidebar" | "dock";
};

export function AdminNavItem({
  href,
  label,
  icon: Icon,
  isActive,
  isCollapsed = false,
  variant = "sidebar",
}: AdminNavItemProps) {
  const isDock = variant === "dock";

  return (
    <Link
      href={href}
      className={`${styles.link} ${isActive ? styles.linkActive : ""} ${isDock ? styles.linkDock : ""} ${!isDock && isCollapsed ? styles.linkCollapsed : ""}`}
      aria-current={isActive ? "page" : undefined}
      title={!isDock && isCollapsed ? label : undefined}
    >
      <Icon className={styles.icon} strokeWidth={ICON_STROKE} aria-hidden />
      <span className={styles.label}>{label}</span>
    </Link>
  );
}
