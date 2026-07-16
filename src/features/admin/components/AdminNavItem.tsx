"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useAdminSectionTransition } from "@/features/admin/components/AdminSectionTransition";
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
  const sectionTransition = useAdminSectionTransition();
  const isDock = variant === "dock";

  return (
    <Link
      href={href}
      className={`${styles.link} ${isActive ? styles.linkActive : ""} ${isDock ? styles.linkDock : ""} ${!isDock && isCollapsed ? styles.linkCollapsed : ""}`}
      aria-current={isActive ? "page" : undefined}
      title={!isDock && isCollapsed ? label : undefined}
      onClick={() => {
        if (!isActive) {
          sectionTransition?.beginNavigation(href);
        }
      }}
    >
      <Icon className={styles.icon} strokeWidth={ICON_STROKE} aria-hidden />
      <span className={styles.label}>{label}</span>
    </Link>
  );
}
