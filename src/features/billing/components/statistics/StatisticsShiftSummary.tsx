"use client";

import type { ReactNode } from "react";
import type { StatisticsMonthLeader } from "@/features/billing/utils/billing-statistics-combine";
import { formatStatisticsAmount } from "@/features/billing/utils/billing-statistics-display";
import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsShiftSummaryProps = {
  noun: "cliente" | "rubro";
  leaders: readonly StatisticsMonthLeader[];
};

function LeaderNames({ names }: { names: readonly string[] }) {
  return names.map((name, index) => {
    let separator: string | null = null;
    if (index > 0) {
      separator = index === names.length - 1 ? " y " : ", ";
    }

    return (
      <span key={`${name}-${index}`}>
        {separator}
        <strong>{name}</strong>
      </span>
    );
  });
}

function leaderLine(leader: StatisticsMonthLeader, noun: "cliente" | "rubro"): ReactNode {
  const month = <strong>{leader.name}</strong>;

  if (leader.state === "future") {
    return <>{month}: todavía no comenzó.</>;
  }

  if (leader.names.length === 0 || !leader.total) {
    return <>{month}: sin facturación de {noun}s.</>;
  }

  const amount = <strong>{formatStatisticsAmount(leader.total)}</strong>;
  if (leader.names.length === 1) {
    return (
      <>
        {month}: <LeaderNames names={leader.names} /> · {amount}
      </>
    );
  }

  return (
    <>
      {month}: empate entre <LeaderNames names={leader.names} /> · {amount}
    </>
  );
}

export function StatisticsShiftSummary({
  noun,
  leaders,
}: StatisticsShiftSummaryProps) {
  if (leaders.length <= 1) {
    return null;
  }

  return (
    <section className={styles.shift} aria-label={`Comparación de ${noun}s por mes`}>
      <div>
        <h3 className={styles.panelTitle}>
          {noun === "cliente" ? "Cliente líder de cada mes" : "Rubro líder de cada mes"}
        </h3>
        <ul className={styles.shiftList}>
          {leaders.map((leader) => (
            <li key={leader.month}>{leaderLine(leader, noun)}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
