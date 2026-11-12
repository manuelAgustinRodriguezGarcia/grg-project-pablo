"use client";

import type {
  StatisticsMonthLeader,
  StatisticsMover,
} from "@/features/billing/utils/billing-statistics-combine";
import {
  formatStatisticsAmount,
  formatStatisticsDelta,
} from "@/features/billing/utils/billing-statistics-display";
import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsShiftSummaryProps = {
  noun: "cliente" | "rubro";
  leaders: readonly StatisticsMonthLeader[];
  increases: readonly StatisticsMover[];
  decreases: readonly StatisticsMover[];
};

function moverText(mover: StatisticsMover): string {
  const gap = mover.skipped ? " Hay meses sin seleccionar entre ambos." : "";
  const percent = mover.percent ? ` · ${mover.percent}` : "";
  return `${mover.name}: ${formatStatisticsDelta(mover.delta)} entre ${mover.earlierName} y ${mover.laterName}.${gap}${percent}`;
}

export function StatisticsShiftSummary({
  noun,
  leaders,
  increases,
  decreases,
}: StatisticsShiftSummaryProps) {
  const showLeaders = leaders.length > 1;

  return (
    <section className={styles.shift} aria-label={`Comparación de ${noun}s por mes`}>
      {showLeaders ? (
        <div>
          <h3 className={styles.panelTitle}>
            {noun === "cliente" ? "Cliente líder de cada mes" : "Rubro líder de cada mes"}
          </h3>
          <ul className={styles.shiftList}>
            {leaders.map((leader) => {
              let text = `${leader.name}: todavía no comenzó.`;
              if (leader.state !== "future" && leader.names.length === 0) {
                text = `${leader.name}: sin facturación de ${noun}s.`;
              } else if (leader.names.length === 1 && leader.total) {
                text = `${leader.name}: ${leader.names[0]} · ${formatStatisticsAmount(leader.total)}`;
              } else if (leader.names.length > 1 && leader.total) {
                text = `${leader.name}: empate entre ${leader.names.join(" y ")} · ${formatStatisticsAmount(leader.total)}`;
              }

              return <li key={leader.month}>{text}</li>;
            })}
          </ul>
        </div>
      ) : null}
      {increases.length > 0 || decreases.length > 0 ? (
        <div>
          <h3 className={styles.panelTitle}>
            {noun === "cliente" ? "Clientes que más cambiaron" : "Rubros que más cambiaron"}
          </h3>
          <ul className={styles.shiftList}>
            {increases.map((mover) => <li key={`up-${mover.key}`}>{moverText(mover)}</li>)}
            {decreases.map((mover) => <li key={`down-${mover.key}`}>{moverText(mover)}</li>)}
          </ul>
          <p className={styles.note}>
            La variación compara el primer y el último mes seleccionado que ya comenzó. No indica la causa del cambio.
          </p>
        </div>
      ) : null}
    </section>
  );
}
