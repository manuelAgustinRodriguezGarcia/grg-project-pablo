"use client";

import { billingInvoiceDetailHref } from "@/features/billing/data/billingNav";
import type {
  StatisticsMoneyView,
  StatisticsReconciliationView,
  StatisticsYearNote,
} from "@/features/billing/types/billing-statistics.types";
import { formatStatisticsAmount } from "@/features/billing/utils/billing-statistics-display";
import { formatIsoDateOnlyForDisplay } from "@/shared/utils/date-only";
import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsNotesProps = {
  creditCount: number;
  debitCount: number;
  creditNotes: StatisticsMoneyView;
  debitNotes: StatisticsMoneyView;
  notes: readonly StatisticsYearNote[];
  reconciliation: StatisticsReconciliationView;
};

function noteLabel(kind: StatisticsYearNote["kind"]): string {
  switch (kind) {
    case "CREDIT":
      return "Nota de crédito";
    case "DEBIT":
      return "Nota de débito";
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

export function StatisticsNotes({
  creditCount,
  debitCount,
  creditNotes,
  debitNotes,
  notes,
  reconciliation,
}: StatisticsNotesProps) {
  const unassigned = reconciliation.unassigned.total !== "0.00" && reconciliation.unassigned.total !== "-0.00";

  return (
    <section className={styles.panel} aria-label="Notas de crédito y débito" data-testid="statistics-notes">
      <h2 className={styles.sectionTitle}>Notas de crédito y débito</h2>
      <ul className={styles.counts}>
        <li>
          <span>Notas de crédito</span>
          <strong>
            {creditCount} — {formatStatisticsAmount(creditNotes.total)}
          </strong>
        </li>
        <li>
          <span>Notas de débito</span>
          <strong>
            {debitCount} — {formatStatisticsAmount(debitNotes.total)}
          </strong>
        </li>
        <li>
          <span>Impacto neto</span>
          <strong className={reconciliation.notes.total.startsWith("-") ? styles.amountNegative : undefined}>
            {formatStatisticsAmount(reconciliation.notes.total)}
          </strong>
        </li>
      </ul>
      {notes.length === 0 ? (
        <p className={styles.empty}>No hay notas de crédito ni de débito en los meses seleccionados.</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.compareTable}>
            <caption className={styles.srOnly}>Notas de los meses seleccionados</caption>
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col">Número</th>
                <th scope="col">Fecha</th>
                <th scope="col">Cliente</th>
                <th scope="col">Monto</th>
                <th scope="col">Factura</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id}>
                  <td>{noteLabel(note.kind)}</td>
                  <td>{note.noteNumber}</td>
                  <td>{formatIsoDateOnlyForDisplay(note.issuedOn)}</td>
                  <td>{note.clientName}</td>
                  <td className={note.totals.total.startsWith("-") ? styles.amountNegative : undefined}>
                    {formatStatisticsAmount(note.totals.total)}
                  </td>
                  <td>{note.invoiceNumber || "—"}</td>
                  <td className={styles.noteActions}>
                    <a
                      className={styles.textButton}
                      href={`/api/admin/billing/notes/${note.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver nota
                    </a>
                    {note.invoiceId ? (
                      <a className={styles.textButton} href={billingInvoiceDetailHref(note.invoiceId)}>
                        Ver factura asociada
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.note}>
        Las notas no tienen líneas de rubro. La factura vinculada muestra los rubros que contenía, no qué parte de ella fue acreditada o debitada.
      </p>
      {unassigned || !reconciliation.distributionMatchGeneral ? (
        <p className={styles.note}>
          {unassigned
            ? `Quedan ${formatStatisticsAmount(reconciliation.unassigned.total)} sin rubro asignable. Ese importe no se reparte entre categorías.`
            : `La distribución y el total general difieren en ${formatStatisticsAmount(reconciliation.distributionMinusGeneral.total)}.`}
        </p>
      ) : null}
    </section>
  );
}
