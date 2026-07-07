"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CustomDatePicker } from "@/shared/components/CustomDatePicker";
import { getTodayIsoDateOnly } from "@/shared/utils/date-only";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";

export type PriceSupplierEditValues = {
  supplierName: string;
  supplierDate: string;
};

type PriceSupplierEditModalProps = {
  initialSupplierName: string | null;
  initialSupplierDate: string | null;
  isBusy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: PriceSupplierEditValues) => void;
};

export function PriceSupplierEditModal({
  initialSupplierName,
  initialSupplierDate,
  isBusy,
  error,
  onClose,
  onSubmit,
}: PriceSupplierEditModalProps) {
  const [supplierName, setSupplierName] = useState(initialSupplierName ?? "");
  const [supplierDate, setSupplierDate] = useState(
    initialSupplierDate ?? getTodayIsoDateOnly(),
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
      supplierName: supplierName.trim(),
      supplierDate,
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
        className={`${modalStyles.modalCard} ${modalStyles.modalCardCompact}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-supplier-edit-title"
      >
        <h2 id="price-supplier-edit-title" className={modalStyles.modalTitle}>
          Editar proveedor
        </h2>
        <p className={modalStyles.modalSubtitle}>
          Actualice el nombre del proveedor y la fecha de la lista seleccionada.
        </p>

        <form onSubmit={handleSubmit}>
          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="supplier-edit-name">
              Nombre de proveedor
            </label>
            <input
              id="supplier-edit-name"
              className={modalStyles.formInput}
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              maxLength={200}
              required
              autoFocus
              disabled={isBusy}
            />
          </div>

          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="supplier-edit-date">
              Fecha
            </label>
            <CustomDatePicker
              value={supplierDate}
              onChange={setSupplierDate}
              disabled={isBusy}
              ariaLabel="Fecha del proveedor"
              triggerClassName={modalStyles.formDateControl}
            />
          </div>

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
              disabled={isBusy || supplierName.trim().length === 0}
            >
              {isBusy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
