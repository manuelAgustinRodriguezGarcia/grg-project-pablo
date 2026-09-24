"use client";

import Link from "next/link";
import { useBeginAdminSectionNavigation } from "@/features/admin/components/AdminSectionTransition";
import type { DashboardPriceListSummary } from "@/features/billing/data/dashboardTypes";
import { CircleDollarSign, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/billing/styles/Dashboard.module.scss";

type LastPriceListCardProps = {
  priceList: DashboardPriceListSummary | null;
};

export function LastPriceListCard({ priceList }: LastPriceListCardProps) {
  const beginNavigation = useBeginAdminSectionNavigation();
  const content = (
    <>
      <div className={styles.cardHeading}>
        <span className={`${styles.cardIcon} ${styles.cardIconAmber}`} aria-hidden>
          <CircleDollarSign strokeWidth={ICON_STROKE} />
        </span>
        <h2 className={styles.cardTitle}>Última lista de precios</h2>
      </div>
      {priceList ? (
        <>
          <p className={styles.realName} title={priceList.name}>
            {priceList.name}
          </p>
          <div className={styles.realFooter}>
            <p className={styles.realMeta}>{priceList.updatedAtLabel}</p>
            <span className={`${styles.cardLink} ${styles.cardLinkAmber}`}>
              Ir a precios
            </span>
          </div>
        </>
      ) : (
        <p className={styles.realMeta}>
          Todavía no hay listas de precios cargadas.
        </p>
      )}
    </>
  );

  if (!priceList) {
    return (
      <section className={`${styles.card} ${styles.realCard}`}>
        {content}
      </section>
    );
  }

  return (
    <Link
      href={priceList.href}
      className={`${styles.card} ${styles.realCard} ${styles.realCardLink}`}
      onClick={() => beginNavigation(priceList.href)}
    >
      {content}
    </Link>
  );
}
