"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { isTypingTarget } from "@/features/billing/hooks/useBillingModalKeyboard";
import { ICON_STROKE, X } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ConfirmCancelPlacement = "actions" | "corner";

type ConfirmDialogSecondaryAction = {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
};

type ConfirmDialogProps = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  cancelLabel?: string;
  cancelPlacement?: ConfirmCancelPlacement;
  secondaryAction?: ConfirmDialogSecondaryAction;
  variant?: "primary" | "danger";
  isBusy?: boolean;
  confirmDisabled?: boolean;
  confirmShortcutKey?: "Delete";
  equalWidthActions?: boolean;
  overlayClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmIcon,
  cancelLabel = "Cancelar",
  cancelPlacement = "actions",
  secondaryAction,
  variant = "primary",
  isBusy = false,
  confirmDisabled = false,
  confirmShortcutKey,
  equalWidthActions = false,
  overlayClassName,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmShortcutKey) {
      return;
    }

    confirmButtonRef.current?.focus();
  }, [confirmShortcutKey]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isBusy) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (
        confirmShortcutKey === "Delete" &&
        event.key === "Delete" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        !event.repeat
      ) {
        if (confirmDisabled) {
          return;
        }
        event.preventDefault();
        onConfirm();
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const actionButtons = cardRef.current
        ? Array.from(
            cardRef.current.querySelectorAll<HTMLButtonElement>(
              "[data-modal-action]:not(:disabled)",
            ),
          )
        : [];

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        if (actionButtons.length === 0) {
          return;
        }
        event.preventDefault();
        const currentIndex = actionButtons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const nextIndex =
          currentIndex <= 0 ? actionButtons.length - 1 : currentIndex - 1;
        actionButtons[nextIndex]?.focus();
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        if (actionButtons.length === 0) {
          return;
        }
        event.preventDefault();
        const currentIndex = actionButtons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const nextIndex =
          currentIndex === -1 || currentIndex === actionButtons.length - 1
            ? 0
            : currentIndex + 1;
        actionButtons[nextIndex]?.focus();
        return;
      }

      if (event.key !== "Enter") {
        return;
      }

      if (event.target instanceof HTMLButtonElement) {
        return;
      }

      if (confirmDisabled) {
        return;
      }

      event.preventDefault();
      onConfirm();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    confirmDisabled,
    confirmShortcutKey,
    isBusy,
    onCancel,
    onConfirm,
  ]);
  if (typeof document === "undefined") {
    return null;
  }

  const confirmClassName =
    variant === "danger" ? styles.confirmDangerButton : styles.confirmPrimaryButton;

  const cancelButton = (
    <button
      type="button"
      className={
        cancelPlacement === "corner"
          ? styles.confirmCornerClose
          : styles.confirmCancelButton
      }
      onClick={onCancel}
      disabled={isBusy}
      data-modal-action="cancel"
      aria-label={cancelPlacement === "corner" ? cancelLabel : undefined}
    >
      {cancelPlacement === "corner" ? (
        <X strokeWidth={ICON_STROKE} aria-hidden />
      ) : (
        <>
          {cancelLabel}
          {confirmShortcutKey ? (
            <kbd className={styles.confirmShortcutKbd} aria-hidden>
              Esc
            </kbd>
          ) : null}
        </>
      )}
    </button>
  );

  let header: ReactNode;
  let actionsCancel: ReactNode;

  switch (cancelPlacement) {
    case "corner":
      header = (
        <div className={styles.confirmHeader}>
          <h3 id="confirm-dialog-title" className={styles.confirmTitle}>
            {title}
          </h3>
          {cancelButton}
        </div>
      );
      actionsCancel = null;
      break;
    case "actions":
      header = (
        <h3 id="confirm-dialog-title" className={styles.confirmTitle}>
          {title}
        </h3>
      );
      actionsCancel = cancelButton;
      break;
    default: {
      const _exhaustive: never = cancelPlacement;
      throw new Error(`Unhandled cancel placement: ${_exhaustive}`);
    }
  }

  const actionsClassName = equalWidthActions
    ? `${styles.confirmActions} ${styles.confirmActionsEqual}`
    : styles.confirmActions;

  return createPortal(
    <div
      className={`${styles.confirmOverlay} ${overlayClassName ?? ""}`.trim()}
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
        ref={cardRef}
      >
        {header}
        <p id="confirm-dialog-message" className={styles.confirmText}>
          {message}
        </p>
        {children}
        <div className={actionsClassName}>
          {actionsCancel}
          {secondaryAction ? (
            <button
              type="button"
              className={styles.confirmCancelButton}
              onClick={secondaryAction.onClick}
              disabled={isBusy || secondaryAction.disabled}
              data-modal-action="secondary"
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </button>
          ) : null}
          <button
            ref={confirmButtonRef}
            type="button"
            className={confirmClassName}
            onClick={onConfirm}
            disabled={isBusy || confirmDisabled}
            data-modal-action="confirm"
          >
            {confirmIcon}
            {confirmLabel}
            {confirmShortcutKey === "Delete" ? (
              <kbd className={styles.confirmShortcutKbd} aria-hidden>
                Supr
              </kbd>
            ) : null}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
