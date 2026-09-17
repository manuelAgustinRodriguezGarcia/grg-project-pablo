"use client";

import { useState } from "react";
import type { BillingInvoiceNoteView } from "@/features/billing/types/billing-invoice.types";
import { NOTE_KIND_SHORT_LABELS } from "@/features/billing/types/billing-note.types";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import { useBillingDocumentActivity } from "@/features/billing/hooks/useBillingDocumentActivity";
import {
  downloadNotePdf,
  notePdfFilename,
} from "@/features/billing/utils/invoice-pdf-client";
import type { BillingNoteKind } from "@/generated/prisma/client";
import { Download, FileText, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type InvoiceNotesPanelProps = {
  notes: BillingInvoiceNoteView[];
  emptyHint: string;
  onIssueCreditNote?: () => void;
  onIssueDebitNote?: () => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function noteKindBadgeClass(kind: BillingNoteKind): string {
  switch (kind) {
    case "CREDIT":
      return styles.movementKindBadgeCredit;
    case "DEBIT":
      return styles.movementKindBadgeDebit;
    default: {
      const exhaustiveCheck: never = kind;
      return exhaustiveCheck;
    }
  }
}

export function InvoiceNotesPanel({
  notes,
  emptyHint,
  onIssueCreditNote,
  onIssueDebitNote,
}: InvoiceNotesPanelProps) {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const markActivity = useBillingDocumentActivity();
  const canIssue = Boolean(onIssueCreditNote || onIssueDebitNote);

  return (
    <section className={styles.proofPanel} aria-label="Notas de crédito y débito">
      <h3 className={styles.historySectionTitle}>Notas de crédito/débito</h3>
      {canIssue ? (
        <div className={styles.noteIssueActions}>
          {onIssueCreditNote ? (
            <button
              type="button"
              className={`${styles.cardActionButton} ${styles.issueReceiptButton}`}
              onClick={onIssueCreditNote}
              aria-label="Emitir nota de crédito"
            >
              <FileText strokeWidth={ICON_STROKE} aria-hidden />
              Nota de crédito
            </button>
          ) : null}
          {onIssueDebitNote ? (
            <button
              type="button"
              className={`${styles.cardActionButton} ${styles.issueReceiptButton}`}
              onClick={onIssueDebitNote}
              aria-label="Emitir nota de débito"
            >
              <FileText strokeWidth={ICON_STROKE} aria-hidden />
              Nota de débito
            </button>
          ) : null}
        </div>
      ) : null}

      {notes.length === 0 ? (
        <p className={styles.proofHint}>{emptyHint}</p>
      ) : (
        <ul className={styles.receiptList}>
          {notes.map((note) => (
            <li key={note.id} className={styles.receiptListItem}>
              <div className={styles.receiptListItemBody}>
                <div className={styles.receiptListItemHeader}>
                  <span
                    className={`${styles.movementKindBadge} ${noteKindBadgeClass(note.kind)}`}
                  >
                    {NOTE_KIND_SHORT_LABELS[note.kind]}
                  </span>
                  <p className={styles.receiptListItemDate}>
                    {DATE_FORMATTER.format(new Date(note.issuedAt))}
                  </p>
                </div>
                <p className={styles.proofFileName}>{note.noteNumber}</p>
                <p className={styles.invoiceMeta}>
                  {formatArsExact(note.amount)} · {note.createdByName}
                </p>
                {note.reason ? (
                  <p className={styles.invoiceMeta}>{note.reason}</p>
                ) : null}
              </div>
              <button
                type="button"
                className={`${styles.cardActionButton} ${styles.receiptDownloadButton}`}
                aria-label={`Descargar ${NOTE_KIND_SHORT_LABELS[note.kind]} ${note.noteNumber}`}
                onClick={() => {
                  setDownloadError(null);
                  void downloadNotePdf(
                    note.id,
                    notePdfFilename(note.kind, note.noteNumber),
                  )
                    .then(() => markActivity("NOTE", note.id, "downloaded"))
                    .catch((caught: unknown) => {
                    setDownloadError(
                      caught instanceof Error
                        ? caught.message
                        : "No se pudo descargar la nota.",
                    );
                  });
                }}
              >
                <Download strokeWidth={ICON_STROKE} aria-hidden />
                Descargar PDF
              </button>
            </li>
          ))}
        </ul>
      )}

      {downloadError ? (
        <p className={styles.inlineError} role="alert">
          {downloadError}
        </p>
      ) : null}
    </section>
  );
}
