"use client";

import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsConclusionsProps = {
  conclusions: readonly string[];
};

export function StatisticsConclusions({ conclusions }: StatisticsConclusionsProps) {
  if (conclusions.length === 0) {
    return null;
  }

  return (
    <section className={styles.panel} aria-label="Conclusiones del período">
      <h2 className={styles.sectionTitle}>Conclusiones del período</h2>
      <ul className={styles.shiftList}>
        {conclusions.map((conclusion) => (
          <li key={conclusion}>{conclusion}</li>
        ))}
      </ul>
    </section>
  );
}
