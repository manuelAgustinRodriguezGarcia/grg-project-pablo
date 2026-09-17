"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useAdminSectionTransition } from "@/features/admin/components/AdminSectionTransition";
import { useUnsavedInvoiceDraft } from "@/features/billing/components/invoices/UnsavedInvoiceDraftContext";
import { ICON_STROKE } from "@/shared/icons";
import styles from "./AdminNavItem.module.scss";

type AdminNavItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  isPending?: boolean;
  isCollapsed?: boolean;
  variant?: "sidebar" | "dock" | "sheet";
  onNavigate?: () => void;
};

export function AdminNavItem({
  href,
  label,
  icon: Icon,
  isActive,
  isPending = false,
  isCollapsed = false,
  variant = "sidebar",
  onNavigate,
}: AdminNavItemProps) {
  const sectionTransition = useAdminSectionTransition();
  const unsavedDraft = useUnsavedInvoiceDraft();
  const isDock = variant === "dock";
  const isSheet = variant === "sheet";
  const showCollapsedTooltip = !isDock && !isSheet && isCollapsed;

  return (
    <span
      className={`${styles.item} ${showCollapsedTooltip ? styles.itemCollapsed : ""}`}
    >
      <Link
        href={href}
        data-nav-href={href}
        className={`${styles.link} ${isActive ? styles.linkActive : ""} ${!isActive && isPending ? styles.linkPending : ""} ${isDock ? styles.linkDock : ""} ${isSheet ? styles.linkSheet : ""} ${showCollapsedTooltip ? styles.linkCollapsed : ""}`}
        aria-current={isActive ? "page" : undefined}
        aria-label={showCollapsedTooltip ? label : undefined}
        onClick={(event) => {
          if (isActive) {
            return;
          }

          if (unsavedDraft?.interceptLeave(event, href)) {
            return;
          }

          onNavigate?.();
          sectionTransition?.beginNavigation(href);
        }}
      >
        <Icon className={styles.icon} strokeWidth={ICON_STROKE} aria-hidden />
        <span className={styles.label}>{label}</span>
      </Link>
      {showCollapsedTooltip ? (
        <span className={styles.collapsedTooltip} role="tooltip">
          {label}
        </span>
      ) : null}
    </span>
  );
}
