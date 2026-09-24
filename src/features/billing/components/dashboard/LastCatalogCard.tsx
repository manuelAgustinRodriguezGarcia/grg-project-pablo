"use client";

import Link from "next/link";
import { useBeginAdminSectionNavigation } from "@/features/admin/components/AdminSectionTransition";
import type { DashboardCatalogSummary } from "@/features/billing/data/dashboardTypes";
import { ICON_STROKE, TableProperties } from "@/shared/icons";
import styles from "@/features/billing/styles/Dashboard.module.scss";

type LastCatalogCardProps = {
  catalog: DashboardCatalogSummary | null;
};

export function LastCatalogCard({ catalog }: LastCatalogCardProps) {
  const beginNavigation = useBeginAdminSectionNavigation();
  const content = (
    <>
      <div className={styles.cardHeading}>
        <span className={`${styles.cardIcon} ${styles.cardIconGreen}`} aria-hidden>
          <TableProperties strokeWidth={ICON_STROKE} />
        </span>
        <h2 className={styles.cardTitle}>Último catálogo</h2>
      </div>
      {catalog ? (
        <>
          <p className={styles.realName} title={catalog.name}>
            {catalog.name}
          </p>
          <div className={styles.realFooter}>
            <p className={styles.realMeta}>{catalog.updatedAtLabel}</p>
            <span className={styles.cardLink}>Ir al catálogo</span>
          </div>
        </>
      ) : (
        <p className={styles.realMeta}>Todavía no hay catálogos cargados.</p>
      )}
    </>
  );

  if (!catalog) {
    return (
      <section className={`${styles.card} ${styles.realCard}`}>
        {content}
      </section>
    );
  }

  return (
    <Link
      href={catalog.href}
      className={`${styles.card} ${styles.realCard} ${styles.realCardLink}`}
      onClick={() => beginNavigation(catalog.href)}
    >
      {content}
    </Link>
  );
}
