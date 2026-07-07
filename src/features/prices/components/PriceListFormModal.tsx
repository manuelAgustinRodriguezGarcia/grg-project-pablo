"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CustomDatePicker } from "@/shared/components/CustomDatePicker";
import type { PriceListListItem } from "@/features/prices/types/price-list.types";
import { getTodayIsoDateOnly } from "@/shared/utils/date-only";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";

export type PriceListFormValues = {
  name: string;
  visibleToNormalUser: boolean;
  supplierName: string;
  supplierDate: string;
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
  const [visibleToNormalUser, setVisibleToNormalUser] = useState(
    initialList?.visibleToNormalUser ?? true,
  );
  const [supplierName, setSupplierName] = useState(initialList?.supplierName ?? "");
  const [supplierDate, setSupplierDate] = useState(
    initialList?.supplierDate ?? getTodayIsoDateOnly(),
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
      visibleToNormalUser,
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
            <label className={modalStyles.formLabel} htmlFor="price-list-supplier-name">
              Nombre de proveedor
            </label>
            <input
              id="price-list-supplier-name"
              className={modalStyles.formInput}
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              maxLength={200}
              disabled={isBusy}
            />
          </div>

          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="price-list-supplier-date">
              Fecha del proveedor
            </label>
            <CustomDatePicker
              value={supplierDate}
              onChange={setSupplierDate}
              disabled={isBusy}
              ariaLabel="Fecha del proveedor"
            />
          </div>

          <div className={modalStyles.formField}>
            <label
              className={`${modalStyles.formLabel} ${modalStyles.formSectionLabel}`}
              htmlFor="price-list-visibility"
            >
              Visibilidad para usuarios
            </label>
            <select
              id="price-list-visibility"
              className={modalStyles.formSelect}
              value={visibleToNormalUser ? "visible" : "hidden"}
              onChange={(event) =>
                setVisibleToNormalUser(event.target.value === "visible")
              }
              disabled={isBusy}
            >
              <option value="visible">Visible</option>
              <option value="hidden">No visible</option>
            </select>
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
