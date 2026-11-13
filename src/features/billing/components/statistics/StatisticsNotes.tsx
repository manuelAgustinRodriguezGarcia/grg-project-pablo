"use client";

import { type MouseEvent } from "react";
import Link from "next/link";
import { useAdminSectionTransition } from "@/features/admin/components/AdminSectionTransition";
import { useUnsavedInvoiceDraft } from "@/features/billing/components/invoices/UnsavedInvoiceDraftContext";
import {
  billingHighlightedInvoiceHref,
  billingHighlightedNoteHref,
} from "@/features/billing/data/billingNav";
import type {
  StatisticsMoneyView,
  StatisticsReconciliationView,
  StatisticsYearNote,
} from "@/features/billing/types/billing-statistics.types";
import { formatStatisticsAmount } from "@/features/billing/utils/billing-statistics-display";
import { ArrowLeftRight, ICON_STROKE, ReceiptText } from "@/shared/icons";
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

function noteKindClass(kind: StatisticsYearNote["kind"]): string {
  switch (kind) {
    case "CREDIT":
      return styles.noteKindCredit;
    case "DEBIT":
      return styles.noteKindDebit;
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
  const sectionTransition = useAdminSectionTransition();
  const unsavedDraft = useUnsavedInvoiceDraft();
  const unassigned = reconciliation.unassigned.total !== "0.00" && reconciliation.unassigned.total !== "-0.00";

  function goToList(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (unsavedDraft?.interceptLeave(event, href, { exact: true })) {
      return;
    }

    sectionTransition?.beginNavigation(href, { exact: true });
  }

  return (
    <section className={styles.panel} aria-label="Notas de crédito y débito" data-testid="statistics-notes">
      <h2 className={`${styles.sectionTitle} ${styles.sectionTitleWithIcon}`}>
        <ArrowLeftRight className={styles.sectionTitleIcon} strokeWidth={ICON_STROKE} aria-hidden />
        Notas de crédito y débito
      </h2>
      <ul className={`${styles.counts} ${styles.countsRow}`}>
        <li className={styles.countCredit}>
          <span>Notas de crédito</span>
          <strong>
            {creditCount} — {formatStatisticsAmount(creditNotes.total)}
          </strong>
        </li>
        <li className={styles.countDebit}>
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
                  <td>
                    <span className={`${styles.noteKindBadge} ${noteKindClass(note.kind)}`}>
                      {noteLabel(note.kind)}
                    </span>
                  </td>
                  <td>{note.noteNumber}</td>
                  <td>{formatIsoDateOnlyForDisplay(note.issuedOn)}</td>
                  <td>{note.clientName}</td>
                  <td className={note.totals.total.startsWith("-") ? styles.amountNegative : undefined}>
                    {formatStatisticsAmount(note.totals.total)}
                  </td>
                  <td>{note.invoiceNumber || "—"}</td>
                  <td className={styles.noteActions}>
                    <span className={styles.noteActionWrap}>
                      <Link
                        className={styles.noteIconButton}
                        href={billingHighlightedNoteHref(note.id)}
                        aria-label="Ver nota"
                        onClick={(event) => {
                          goToList(event, billingHighlightedNoteHref(note.id));
                        }}
                      >
                        <ArrowLeftRight strokeWidth={ICON_STROKE} aria-hidden />
                      </Link>
                      <span className={styles.noteActionTooltip} role="tooltip">
                        Ver nota
                      </span>
                    </span>
                    {note.invoiceId ? (
                      <span className={styles.noteActionWrap}>
                        <Link
                          className={styles.noteIconButton}
                          href={billingHighlightedInvoiceHref(note.invoiceId)}
                          aria-label="Ver factura asociada"
                          onClick={(event) => {
                            goToList(
                              event,
                              billingHighlightedInvoiceHref(note.invoiceId),
                            );
                          }}
                        >
                          <ReceiptText strokeWidth={ICON_STROKE} aria-hidden />
                        </Link>
                        <span className={styles.noteActionTooltip} role="tooltip">
                          Ver factura asociada
                        </span>
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
