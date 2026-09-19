"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAdminSectionTransition } from "@/features/admin/components/AdminSectionTransition";
import { BILLING_MOVIMIENTOS_PATH } from "@/features/billing/data/billingNav";
import { useBillingDocumentActivity } from "@/features/billing/hooks/useBillingDocumentActivity";
import {
  useBillingSuccessShortcuts,
} from "@/features/billing/hooks/useBillingModalKeyboard";
import type { BillingDocumentKind } from "@/features/billing/types/billing-document-activity";
import {
  downloadNotePdf,
  downloadReceiptPdf,
  getNotePdfFile,
  getReceiptPdfFile,
  notePdfFilename,
  printNotePdf,
  printReceiptPdf,
  receiptPdfFilename,
  sharePdfFile,
} from "@/features/billing/utils/invoice-pdf-client";
import {
  buildMailtoShareUrl,
  buildWhatsAppShareUrl,
  getEmailShareLabel,
  getWhatsAppShareLabel,
  toWhatsAppDigits,
} from "@/features/billing/utils/invoice-share";
import {
  ArrowLeftRight,
  CheckCircle2,
  Download,
  ICON_STROKE,
  Mail,
  Printer,
  Share2,
  X,
} from "@/shared/icons";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

export type BillingIssueSuccessKind = "RECEIPT" | "CREDIT" | "DEBIT";

type BillingIssueSuccessModalProps = {
  kind: BillingIssueSuccessKind;
  documentId: string;
  documentNumber: string;
  meta: string;
  clientWhatsapp?: string | null;
  clientEmail?: string | null;
  embedded?: boolean;
  onCreateAnother: () => void;
  onClose: () => void;
};

const CLOSE_ANIMATION_MS = 180;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function successCopy(kind: BillingIssueSuccessKind): {
  title: string;
  anotherLabel: string;
} {
  switch (kind) {
    case "RECEIPT":
      return { title: "Recibo emitido", anotherLabel: "Crear nuevo" };
    case "CREDIT":
      return {
        title: "Nota de crédito emitida",
        anotherLabel: "Crear nuevo",
      };
    case "DEBIT":
      return {
        title: "Nota de débito emitida",
        anotherLabel: "Crear nuevo",
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function documentKindForSuccess(
  kind: BillingIssueSuccessKind,
): BillingDocumentKind {
  switch (kind) {
    case "RECEIPT":
      return "RECEIPT";
    case "CREDIT":
    case "DEBIT":
      return "NOTE";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function BillingIssueSuccessModal({
  kind,
  documentId,
  documentNumber,
  meta,
  clientWhatsapp = null,
  clientEmail = null,
  embedded = false,
  onCreateAnother,
  onClose,
}: BillingIssueSuccessModalProps) {
  const sectionTransition = useAdminSectionTransition();
  const copy = successCopy(kind);
  const markActivity = useBillingDocumentActivity();
  const [isClosing, setIsClosing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "print" | "download" | "whatsapp" | "email" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const whatsappDigits = toWhatsAppDigits(clientWhatsapp);
  const email = clientEmail?.trim() || null;
  const shareCaption = `${copy.title} ${documentNumber}`;
  const shareSubject = `${copy.title} ${documentNumber} - Rothamel Repuestos`;

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function requestClose() {
    if (isClosing) {
      return;
    }

    if (embedded || prefersReducedMotion()) {
      onClose();
      return;
    }

    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, CLOSE_ANIMATION_MS);
  }

  async function runPrint(): Promise<void> {
    setBusyAction("print");
    setError(null);
    try {
      if (kind === "RECEIPT") {
        await printReceiptPdf(documentId);
      } else {
        await printNotePdf(documentId);
      }
      await markActivity(documentKindForSuccess(kind), documentId, "printed");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo imprimir.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function runDownload(): Promise<void> {
    setBusyAction("download");
    setError(null);
    try {
      if (kind === "RECEIPT") {
        await downloadReceiptPdf(documentId, receiptPdfFilename(documentNumber));
      } else {
        await downloadNotePdf(
          documentId,
          notePdfFilename(kind === "CREDIT" ? "CREDIT" : "DEBIT", documentNumber),
        );
      }
      await markActivity(documentKindForSuccess(kind), documentId, "downloaded");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo descargar.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function runShare(channel: "whatsapp" | "email"): Promise<void> {
    setBusyAction(channel);
    setError(null);
    try {
      const file =
        kind === "RECEIPT"
          ? await getReceiptPdfFile(
              documentId,
              receiptPdfFilename(documentNumber),
            )
          : await getNotePdfFile(
              documentId,
              notePdfFilename(
                kind === "CREDIT" ? "CREDIT" : "DEBIT",
                documentNumber,
              ),
            );
      const result = await sharePdfFile(file, shareSubject, shareCaption);
      if (result === "cancelled") {
        return;
      }

      if (result === "saved") {
        if (channel === "whatsapp" && whatsappDigits) {
          window.open(
            buildWhatsAppShareUrl(whatsappDigits, shareCaption),
            "_blank",
            "noopener,noreferrer",
          );
        } else if (channel === "email" && email) {
          window.location.href = buildMailtoShareUrl(email, shareSubject);
        }
      }

      await markActivity(documentKindForSuccess(kind), documentId, "shared");
      setShareOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo compartir.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function goToList() {
    sectionTransition?.beginNavigation(BILLING_MOVIMIENTOS_PATH, {
      exact: true,
    });
    requestClose();
  }

  useBillingSuccessShortcuts(
    {
      onPrint: () => {
        void runPrint();
      },
      onDownload: () => {
        void runDownload();
      },
      onShare: () => setShareOpen(true),
      onCreateNew: onCreateAnother,
      onList: goToList,
      onClose: requestClose,
    },
    !isClosing && busyAction === null,
  );

  const dialog = (
      <div
        className={`${modalStyles.modalCard} ${styles.issueSuccessCard}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-issue-success-title"
      >
        <button
          type="button"
          className={`${styles.invoiceDetailClose} ${styles.issueSuccessClose}`}
          onClick={requestClose}
          aria-label="Cerrar"
        >
          <X strokeWidth={ICON_STROKE} aria-hidden />
        </button>
        <CheckCircle2
          className={styles.issueSuccessIcon}
          strokeWidth={ICON_STROKE}
          aria-hidden
        />
        <h2
          id="billing-issue-success-title"
          className={styles.issueSuccessTitle}
        >
          {copy.title}
        </h2>
        <p className={styles.issueSuccessNumber}>{documentNumber}</p>
        <p className={styles.issueSuccessMeta}>{meta}</p>
        <p className={styles.issueSuccessHint}>
          El comprobante quedó guardado. No fue enviado a ARCA y no tiene
          validez fiscal.
        </p>
        {error ? (
          <p className={styles.inlineError} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.issueSuccessActions}>
          <div className={styles.issueSuccessDocActions}>
            <Link
              href={BILLING_MOVIMIENTOS_PATH}
              className={styles.issueSuccessSecondary}
              onClick={goToList}
            >
              <ArrowLeftRight strokeWidth={ICON_STROKE} aria-hidden />
              Ver lista
              <kbd className={styles.shortcutKbd}>L</kbd>
            </Link>
            <button
              type="button"
              className={styles.issueSuccessSecondary}
              onClick={() => {
                void runDownload();
              }}
              disabled={busyAction !== null}
            >
              <Download strokeWidth={ICON_STROKE} aria-hidden />
              Descargar
              <kbd className={styles.shortcutKbd}>D</kbd>
            </button>
            <div className={styles.shareMenuWrap}>
              <button
                type="button"
                className={styles.issueSuccessSecondary}
                onClick={() => setShareOpen((current) => !current)}
                disabled={busyAction !== null}
              >
                <Share2 strokeWidth={ICON_STROKE} aria-hidden />
                Compartir
                <kbd className={styles.shortcutKbd}>C</kbd>
              </button>
              {shareOpen ? (
                <div className={styles.shareMenu} role="menu">
                  <button
                    type="button"
                    className={styles.shareMenuItem}
                    disabled={!whatsappDigits || busyAction !== null}
                    role="menuitem"
                    onClick={() => {
                      void runShare("whatsapp");
                    }}
                  >
                    <WhatsAppIcon />
                    {busyAction === "whatsapp"
                      ? "Preparando PDF…"
                      : getWhatsAppShareLabel(clientWhatsapp)}
                  </button>
                  <button
                    type="button"
                    className={styles.shareMenuItem}
                    disabled={!email || busyAction !== null}
                    role="menuitem"
                    onClick={() => {
                      void runShare("email");
                    }}
                  >
                    <Mail strokeWidth={ICON_STROKE} aria-hidden />
                    {busyAction === "email"
                      ? "Preparando PDF…"
                      : getEmailShareLabel(clientEmail)}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className={styles.issueSuccessNavActions}>
            <button
              type="button"
              className={styles.issueSuccessSecondary}
              onClick={onCreateAnother}
            >
              {copy.anotherLabel}
              <kbd className={styles.shortcutKbd}>N</kbd>
            </button>
            <button
              type="button"
              className={styles.issueSuccessPrimary}
              onClick={() => {
                void runPrint();
              }}
              disabled={busyAction !== null}
            >
              <Printer strokeWidth={ICON_STROKE} aria-hidden />
              Imprimir
              <kbd className={styles.shortcutKbd}>I</kbd>
            </button>
          </div>
        </div>
        <p className={styles.issueSuccessShortcuts}>
          Esc cierra el aviso.
        </p>
      </div>
  );

  if (embedded) {
    return dialog;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`${modalStyles.modalOverlay} ${styles.receiptFormOverlay}${
        isClosing ? ` ${styles.receiptFormOverlayClosing}` : ""
      }`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      {dialog}
    </div>,
    document.body,
  );
}
