"use client";

import { useReportAdminSectionReady } from "@/features/admin/components/AdminSectionTransition";
import styles from "@/features/billing/styles/BillingSectionPlaceholder.module.scss";

type BillingSectionPlaceholderProps = {
  title: string;
  description: string;
};

export function BillingSectionPlaceholder({
  title,
  description,
}: BillingSectionPlaceholderProps) {
  useReportAdminSectionReady(true);

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      <p className={styles.note}>
        Placeholder de la Fase 1. El contenido funcional se implementará en los
        próximos sprints.
      </p>
    </div>
  );
}
