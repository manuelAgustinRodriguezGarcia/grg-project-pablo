"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ICON_STROKE, Printer } from "@/shared/icons";
import confirmStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import styles from "@/features/billing/styles/NewInvoice.module.scss";

export type UnprintedLeaveAction = {
  label: string;
  shortcut?: string;
};

type UnprintedInvoiceLeaveDialogProps = {
  isPrinting: boolean;
  error: string | null;
  leaveAction: UnprintedLeaveAction;
  onPrint: () => void;
  onLeave: () => void;
  onStay: () => void;
};

export function UnprintedInvoiceLeaveDialog({
  isPrinting,
  error,
  leaveAction,
  onPrint,
  onLeave,
  onStay,
}: UnprintedInvoiceLeaveDialogProps) {
  const printButtonRef = useRef<HTMLButtonElement>(null);
  const leaveShortcut = leaveAction.shortcut?.toLowerCase() ?? null;

  useEffect(() => {
    printButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isPrinting) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onStay();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "i") {
        event.preventDefault();
        onPrint();
        return;
      }

      if (leaveShortcut && key === leaveShortcut) {
        event.preventDefault();
        onLeave();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPrinting, leaveShortcut, onLeave, onPrint, onStay]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={confirmStyles.confirmOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPrinting) {
          onStay();
        }
      }}
    >
      <div
        className={`${confirmStyles.confirmCard} ${styles.unprintedLeaveCard}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unprinted-invoice-title"
        aria-describedby="unprinted-invoice-message"
      >
        <Printer
          className={styles.unprintedLeaveIcon}
          strokeWidth={ICON_STROKE}
          aria-hidden
        />
        <h2 id="unprinted-invoice-title" className={styles.unprintedLeaveTitle}>
          Esta factura no fue impresa
        </h2>
        <p
          id="unprinted-invoice-message"
          className={styles.unprintedLeaveText}
        >
          ¿Está seguro que desea seguir sin imprimirla?
        </p>
        {error ? (
          <p className={styles.blockingError} role="alert">
            {error}
          </p>
        ) : null}
        <div
          className={`${confirmStyles.confirmActions} ${styles.unprintedLeaveActions}`}
        >
          <button
            type="button"
            className={confirmStyles.confirmCancelButton}
            onClick={onLeave}
            disabled={isPrinting}
            aria-keyshortcuts={leaveAction.shortcut}
          >
            {leaveAction.label}
            {leaveAction.shortcut ? (
              <kbd className={styles.shortcutKbd}>{leaveAction.shortcut}</kbd>
            ) : null}
          </button>
          <button
            ref={printButtonRef}
            type="button"
            className={`${confirmStyles.confirmPrimaryButton} ${styles.unprintedLeavePrintButton}`}
            onClick={onPrint}
            disabled={isPrinting}
            aria-keyshortcuts="I"
          >
            {isPrinting ? "Abriendo…" : "Imprimir Factura"}
            {isPrinting ? null : (
              <kbd className={styles.shortcutKbd}>I</kbd>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
