"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PriceListListItem } from "@/features/prices/types/price-list.types";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";

export type PriceListFormValues = {
  name: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  visibleToNormalUser: boolean;
};

type PriceListFormModalProps = {
  mode: "create" | "edit";
  initialList?: PriceListListItem | null;
  isBusy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: PriceListFormValues) => void;
};

export function PriceListFormModal({
  mode,
  initialList,
  isBusy,
  error,
  onClose,
  onSubmit,
}: PriceListFormModalProps) {
  const [name, setName] = useState(initialList?.name ?? "");
  const [description, setDescription] = useState(initialList?.description ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(
    initialList?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  );
  const [visibleToNormalUser, setVisibleToNormalUser] = useState(
    initialList?.visibleToNormalUser ?? true,
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      status,
      visibleToNormalUser,
    });
  }

  return createPortal(
    <div
      className={modalStyles.modalOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <div
        className={modalStyles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-list-form-title"
      >
        <h2 id="price-list-form-title" className={modalStyles.modalTitle}>
          {mode === "create" ? "Nueva lista de precios" : "Editar lista de precios"}
        </h2>
        <p className={modalStyles.modalSubtitle}>
          {mode === "create"
            ? "Definí el nombre y la visibilidad de la nueva lista."
            : "Actualizá los datos de la lista seleccionada."}
        </p>

        <form onSubmit={handleSubmit}>
          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="price-list-name">
              Nombre
            </label>
            <input
              id="price-list-name"
              className={modalStyles.formInput}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              required
              autoFocus
              disabled={isBusy}
            />
          </div>

          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="price-list-description">
              Descripción (opcional)
            </label>
            <textarea
              id="price-list-description"
              className={modalStyles.formTextarea}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              disabled={isBusy}
            />
          </div>

          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="price-list-status">
              Estado
            </label>
            <select
              id="price-list-status"
              className={modalStyles.formSelect}
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "ACTIVE" | "INACTIVE")
              }
              disabled={isBusy}
            >
              <option value="ACTIVE">Activa</option>
              <option value="INACTIVE">Inactiva</option>
            </select>
          </div>

          <label className={modalStyles.toggleField}>
            <input
              type="checkbox"
              checked={visibleToNormalUser}
              onChange={(event) => setVisibleToNormalUser(event.target.checked)}
              disabled={isBusy}
            />
            Visible para usuarios de consulta
          </label>

          {error ? <p className={modalStyles.formError}>{error}</p> : null}

          <div className={modalStyles.modalActions}>
            <button
              type="button"
              className={modalStyles.modalCancelButton}
              onClick={onClose}
              disabled={isBusy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={modalStyles.modalSaveButton}
              disabled={isBusy || name.trim().length === 0}
            >
              {isBusy ? "Guardando…" : mode === "create" ? "Crear lista" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
