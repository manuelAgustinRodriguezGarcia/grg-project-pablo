"use client";

import type {
  StatisticsAdjustmentsView,
  StatisticsCountsView,
  StatisticsReconciliationView,
  StatisticsUnassignedView,
} from "@/features/billing/types/billing-statistics.types";
import { countLabel, formatStatisticsAmount } from "@/features/billing/utils/billing-statistics-display";
import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsAdjustmentsProps = {
  reconciliation: StatisticsReconciliationView;
  counts: StatisticsCountsView;
  unassigned: StatisticsUnassignedView | null;
  adjustments: StatisticsAdjustmentsView | null;
};

function Amount({ value }: { value: string }) {
  return (
    <strong className={value.startsWith("-") ? styles.amountNegative : undefined}>
      {formatStatisticsAmount(value)}
    </strong>
  );
}

function adjustmentNoteSentence(creditNoteCount: number, debitNoteCount: number): string | null {
  const parts: string[] = [];
  if (creditNoteCount > 0) {
    parts.push(countLabel(creditNoteCount, "nota de crédito", "notas de crédito"));
  }
  if (debitNoteCount > 0) {
    parts.push(countLabel(debitNoteCount, "nota de débito", "notas de débito"));
  }
  if (parts.length === 0) {
    return null;
  }

  const verb = creditNoteCount + debitNoteCount === 1 ? "compone" : "componen";
  return `${parts.join(" y ")} ${verb} los ajustes.`;
}

export function StatisticsAdjustments({
  reconciliation,
  counts,
  unassigned,
  adjustments,
}: StatisticsAdjustmentsProps) {
  const adjustmentNotes = adjustmentNoteSentence(
    adjustments?.counts.creditNoteCount ?? 0,
    adjustments?.counts.debitNoteCount ?? 0,
  );

  return (
    <section className={styles.panel} aria-label="Ajustes y montos sin asignar" data-testid="adjustments">
      <h2 className={styles.sectionTitle}>Ajustes y montos sin asignar</h2>
      <p className={styles.note}>
        Estos importes no son rubros comerciales y quedan fuera del gráfico de participación.
      </p>
      <dl className={styles.reconcile}>
        <div>
          <dt>Notas de crédito</dt>
          <dd>{countLabel(counts.creditNoteCount, "comprobante", "comprobantes")}</dd>
        </div>
        <div>
          <dt>Notas de débito</dt>
          <dd>{countLabel(counts.debitNoteCount, "comprobante", "comprobantes")}</dd>
        </div>
        <div>
          <dt>Ajustes sin rubro</dt>
          <dd><Amount value={reconciliation.adjustments.total} /></dd>
        </div>
        <div>
          <dt>Sin rubro asignable</dt>
          <dd><Amount value={reconciliation.unassigned.total} /></dd>
        </div>
        <div>
          <dt>Rubros comerciales</dt>
          <dd><Amount value={reconciliation.rubros.total} /></dd>
        </div>
        <div>
          <dt>Total general</dt>
          <dd><Amount value={reconciliation.general.total} /></dd>
        </div>
      </dl>
      {unassigned ? (
        <p className={styles.rankMeta}>
          {countLabel(unassigned.lineCount, "línea", "líneas")} y {countLabel(unassigned.invoiceCount, "factura", "facturas")} con importe sin asignar.
        </p>
      ) : null}
      {adjustmentNotes ? <p className={styles.rankMeta}>{adjustmentNotes}</p> : null}
      <p className={styles.note}>
        {reconciliation.distributionMatchGeneral
          ? "Rubros comerciales, montos sin asignar y ajustes coinciden con el total general."
          : `La distribución difiere del total general en ${formatStatisticsAmount(reconciliation.distributionMinusGeneral.total)}.`}
      </p>
      <p className={styles.note}>
        {reconciliation.clientsMatchGeneral
          ? "Los importes por cliente coinciden con el total general."
          : `Los importes por cliente difieren del total general en ${formatStatisticsAmount(reconciliation.clientsMinusGeneral.total)}.`}
      </p>
    </section>
  );
}
