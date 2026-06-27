"use client";

import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, ICON_STROKE } from "@/shared/icons";
import styles from "./AdminSignOutButton.module.scss";

const LOGOUT_PATH = "/api/auth/logout";

type AdminSignOutButtonProps = {
  variant?: "default" | "sidebar" | "dock";
  isCollapsed?: boolean;
};

export function AdminSignOutButton({
  variant = "default",
  isCollapsed = false,
}: AdminSignOutButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const isSidebar = variant === "sidebar";
  const isDock = variant === "dock";

  const openConfirm = useCallback(() => {
    setIsConfirmOpen(true);
  }, []);

  const closeConfirm = useCallback(() => {
    if (!isSubmitting) {
      setIsConfirmOpen(false);
    }
  }, [isSubmitting]);

  const handleConfirm = useCallback(() => {
    setIsSubmitting(true);
    formRef.current?.requestSubmit();
  }, []);

  const confirmDialog =
    isConfirmOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className={styles.confirmOverlay}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isSubmitting) {
                closeConfirm();
              }
            }}
          >
            <div
              className={styles.confirmCard}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <div className={styles.confirmIconWrap} aria-hidden="true">
                <LogOut className={styles.confirmIcon} strokeWidth={ICON_STROKE} />
              </div>
              <p id={titleId} className={styles.confirmMessage}>
                ¿Seguro que desea cerrar sesión?
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.confirmCancelButton}
                  onClick={closeConfirm}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.confirmDangerButton}
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <form
        ref={formRef}
        action={LOGOUT_PATH}
        method="POST"
        className={
          isDock ? styles.formDock : isSidebar ? styles.formSidebar : styles.form
        }
      >
        <button
          type="button"
          className={`${isDock ? styles.buttonDock : isSidebar ? styles.buttonSidebar : styles.button} ${isSidebar && isCollapsed ? styles.buttonSidebarCollapsed : ""}`}
          title={isSidebar && isCollapsed ? "Cerrar sesión" : undefined}
          onClick={openConfirm}
        >
          <LogOut className={styles.icon} strokeWidth={ICON_STROKE} aria-hidden />
          <span className={styles.label}>Cerrar sesión</span>
        </button>
      </form>
      {confirmDialog}
    </>
  );
}
