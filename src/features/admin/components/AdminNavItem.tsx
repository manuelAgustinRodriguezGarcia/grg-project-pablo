import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ICON_STROKE } from "@/shared/icons";
import styles from "./AdminNavItem.module.scss";

type AdminNavItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
};

export function AdminNavItem({
  href,
  label,
  icon: Icon,
  isActive,
}: AdminNavItemProps) {
  return (
    <Link
      href={href}
      className={`${styles.link} ${isActive ? styles.linkActive : ""}`}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className={styles.icon} strokeWidth={ICON_STROKE} aria-hidden />
      <span>{label}</span>
    </Link>
  );
}
