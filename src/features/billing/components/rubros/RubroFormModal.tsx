"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { BillingRubroListItem } from "@/features/billing/types/billing-rubro.types";
import { AlertTriangle, ICON_STROKE, X } from "@/shared/icons";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";
import wizardStyles from "@/features/imports/components/ImportWizard.module.scss";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

export type RubroFormValues = {
  code: string;
  name: string;
  description: string;
};

type RubroFormModalProps = {
  mode: "create" | "edit";
  initialRubro?: BillingRubroListItem | null;
  isBusy: boolean;
  error: string | null;
  onClearError: () => void;
  onClose: () => void;
  onSubmit: (values: RubroFormValues) => void;
};

export function RubroFormModal({
  mode,
  initialRubro,
  isBusy,
  error,
  onClearError,
  onClose,
  onSubmit,
}: RubroFormModalProps) {
  const [code, setCode] = useState(initialRubro?.code ?? "");
  const [name, setName] = useState(initialRubro?.name ?? "");
  const [description, setDescription] = useState(
    initialRubro?.description ?? "",
  );
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isDirty =
    code !== (initialRubro?.code ?? "") ||
    name !== (initialRubro?.name ?? "") ||
    description !== (initialRubro?.description ?? "");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || isBusy) {
        return;
      }

      if (showDiscardConfirm) {
        setShowDiscardConfirm(false);
        return;
      }

      if (isDirty) {
        setShowDiscardConfirm(true);
        return;
      }

      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, isDirty, showDiscardConfirm, onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  function requestClose() {
    if (isBusy) {
      return;
    }

    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }

    onClose();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    onSubmit({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim(),
    });
  }

  const title = mode === "create" ? "Nuevo rubro" : "Editar rubro";
  const subtitle =
    mode === "create"
      ? "Cargue el rubro para usarlo al emitir facturas."
      : `Actualice los datos del rubro ${initialRubro?.code ?? ""}.`;
  const isCreate = mode === "create";

  return createPortal(
    <div
      className={modalStyles.modalOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        className={modalStyles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rubro-form-title"
      >
        <div className={modalStyles.modalHeader}>
          <div className={modalStyles.modalHeaderText}>
            <h2 id="rubro-form-title" className={modalStyles.modalTitle}>
              {title}
            </h2>
            <p className={modalStyles.modalSubtitle}>{subtitle}</p>
          </div>
          <button
            type="button"
            className={modalStyles.modalCloseButton}
            onClick={requestClose}
            disabled={isBusy}
            aria-label="Cerrar"
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="rubro-code">
              Código{isCreate ? " (opcional)" : ""}
            </label>
            <input
              id="rubro-code"
              className={`${modalStyles.formInput} ${styles.uppercaseInput}`}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/[^a-zA-Z0-9-]/g, ""));
                onClearError();
              }}
              placeholder="ALTER-0003"
              maxLength={32}
              required={!isCreate}
              autoFocus
              disabled={isBusy}
            />
            <p className={styles.formHint}>
              {isCreate
                ? "Si lo deja vacío, el sistema lo genera automáticamente. Debe ser único."
                : "Debe ser único. Solo letras, números y guiones."}
            </p>
          </div>

          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="rubro-name">
              Nombre del rubro
            </label>
            <input
              id="rubro-name"
              className={modalStyles.formInput}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                onClearError();
              }}
              placeholder="Embragues"
              maxLength={120}
              required
              disabled={isBusy}
            />
          </div>

          <div className={modalStyles.formField}>
            <label
              className={modalStyles.formLabel}
              htmlFor="rubro-description"
            >
              Descripción (opcional)
            </label>
            <textarea
              id="rubro-description"
              className={`${modalStyles.formInput} ${styles.notesTextarea}`}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                onClearError();
              }}
              placeholder="Texto base que aparecerá en la factura…"
              maxLength={500}
              rows={3}
              disabled={isBusy}
            />
            <p className={styles.formHint}>
              Se usa como texto base al facturar. Podrá sobrescribirla en cada
              factura sin modificar el rubro.
            </p>
          </div>

          {error ? (
            <p className={styles.formErrorPill} role="alert">
              {error}
            </p>
          ) : null}

          <div className={modalStyles.modalActions}>
            <button
              type="submit"
              className={modalStyles.modalSaveButton}
              disabled={
                isBusy ||
                name.trim().length === 0 ||
                (!isCreate && code.trim().length === 0)
              }
            >
              {isBusy
                ? "Guardando…"
                : isCreate
                  ? "Crear rubro"
                  : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>

      {showDiscardConfirm ? (
        <div className={wizardStyles.confirmOverlay}>
          <div
            className={`${wizardStyles.confirmCard} ${wizardStyles.closeConfirmCard}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="rubro-discard-title"
            aria-describedby="rubro-discard-text"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div className={wizardStyles.closeConfirmIcon} aria-hidden>
              <AlertTriangle strokeWidth={ICON_STROKE} />
            </div>
            <h3
              id="rubro-discard-title"
              className={wizardStyles.closeConfirmTitle}
            >
              ¿Descartar cambios?
            </h3>
            <p id="rubro-discard-text" className={wizardStyles.closeConfirmText}>
              Los datos cargados no se guardarán si cierra el formulario ahora.
            </p>
            <div className={wizardStyles.closeConfirmActions}>
              <button
                type="button"
                className={wizardStyles.primaryButton}
                onClick={() => setShowDiscardConfirm(false)}
              >
                Seguir editando
              </button>
              <button
                type="button"
                className={wizardStyles.dangerButton}
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onClose();
                }}
              >
                Descartar cambios
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
