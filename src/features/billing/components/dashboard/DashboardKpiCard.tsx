"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useBeginAdminSectionNavigation } from "@/features/admin/components/AdminSectionTransition";
import type { DashboardKpi } from "@/features/billing/data/dashboardTypes";
import { ICON_STROKE } from "@/shared/icons";
import styles from "@/features/billing/styles/Dashboard.module.scss";

type DashboardKpiCardProps = {
  kpi: DashboardKpi;
  icon?: LucideIcon;
  href?: string;
  footerLabel?: string;
};

const TONE_CLASS: Record<DashboardKpi["tone"], string> = {
  blue: styles.kpiToneBlue,
  green: styles.kpiToneGreen,
  amber: styles.kpiToneAmber,
  red: styles.kpiToneRed,
};

export function DashboardKpiCard({
  kpi,
  icon: Icon,
  href,
  footerLabel,
}: DashboardKpiCardProps) {
  const content = (
    <>
      <div className={styles.kpiTop}>
        <p className={styles.kpiLabel}>{kpi.label}</p>
        {Icon ? (
          <span className={styles.kpiIcon} aria-hidden>
            <Icon strokeWidth={ICON_STROKE} />
          </span>
        ) : null}
      </div>
      <p className={styles.kpiValue}>{kpi.value}</p>
      {footerLabel ? (
        <div className={styles.realFooter}>
          <p
            className={`${styles.kpiSecondary} ${kpi.trendPositive ? styles.kpiSecondaryPositive : ""}`}
          >
            {kpi.secondary}
          </p>
          <span className={styles.cardLink}>{footerLabel}</span>
        </div>
      ) : (
        <p
          className={`${styles.kpiSecondary} ${kpi.trendPositive ? styles.kpiSecondaryPositive : ""}`}
        >
          {kpi.secondary}
        </p>
      )}
    </>
  );

  const className = `${styles.kpiCard} ${TONE_CLASS[kpi.tone]} ${href ? styles.kpiCardLink : ""}`;
  const beginNavigation = useBeginAdminSectionNavigation();

  if (!href) {
    return <article className={className}>{content}</article>;
  }

  return (
    <Link
      href={href}
      className={className}
      onClick={() => beginNavigation(href, { exact: true })}
    >
      {content}
    </Link>
  );
}
