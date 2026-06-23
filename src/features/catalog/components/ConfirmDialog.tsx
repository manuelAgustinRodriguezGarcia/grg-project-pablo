"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ConfirmDialogProps = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  isBusy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  variant = "primary",
  isBusy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (typeof document === "undefined") {
    return null;
  }

  const confirmClassName =
    variant === "danger" ? styles.confirmDangerButton : styles.confirmPrimaryButton;

  return createPortal(
    <div
      className={styles.confirmOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onCancel();
        }
      }}
    >
      <div
        className={styles.confirmCard}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <h3 id="confirm-dialog-title" className={styles.confirmTitle}>
          {title}
        </h3>
        <p id="confirm-dialog-message" className={styles.confirmText}>
          {message}
        </p>
        {children}
        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.confirmCancelButton}
            onClick={onCancel}
            disabled={isBusy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmClassName}
            onClick={onConfirm}
            disabled={isBusy || confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
