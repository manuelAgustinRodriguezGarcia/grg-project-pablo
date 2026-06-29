"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { PriceColumnListItem } from "@/features/prices/types/price-column.types";
import type { PriceItemTableRow } from "@/features/prices/types/price-item-table.types";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";

type PriceItemFormModalProps = {
  priceListId: string;
  columns: PriceColumnListItem[];
  item?: PriceItemTableRow | null;
  onClose: () => void;
  onSaved: () => void;
};

function buildInitialValues(
  columns: PriceColumnListItem[],
  item?: PriceItemTableRow | null,
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const column of columns) {
    if (!column.isAdminEditable) {
      continue;
    }

    if (!item) {
      values[column.internalKey] = "";
      continue;
    }

    if (column.isPrimaryCode) {
      values[column.internalKey] = item.primaryCode ?? "";
    } else if (column.isDescription) {
      values[column.internalKey] = item.description ?? "";
    } else if (column.isPrice) {
      values[column.internalKey] = item.amount ?? "";
    } else {
      const dynamicValue = item.dynamicData[column.internalKey];
      values[column.internalKey] =
        dynamicValue === null || dynamicValue === undefined
          ? ""
          : String(dynamicValue);
    }
  }

  return values;
}

export function PriceItemFormModal({
  priceListId,
  columns,
  item = null,
  onClose,
  onSaved,
}: PriceItemFormModalProps) {
  const isEditMode = item !== null && item !== undefined;

  const editableColumns = useMemo(
    () =>
      columns.filter(
        (column) =>
          column.isAdminEditable &&
          (column.isPrimaryCode ||
            column.isDescription ||
            column.isPrice ||
            !column.isReadOnly),
      ),
    [columns],
  );

  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialValues(editableColumns, item),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  function updateValue(internalKey: string, value: string) {
    setValues((current) => ({ ...current, [internalKey]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const payloadValues: Record<string, unknown> = {};
    for (const column of editableColumns) {
      const raw = values[column.internalKey] ?? "";
      if (raw.trim() === "") {
        continue;
      }
      payloadValues[column.internalKey] = raw.trim();
    }

    try {
      const url = isEditMode
        ? `/api/admin/price-lists/${priceListId}/items/${item!.id}`
        : `/api/admin/price-lists/${priceListId}/items`;
      const response = await fetch(url, {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payloadValues }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(
          payload?.error ??
            (isEditMode ? "No se pudo actualizar el ítem." : "No se pudo crear el ítem."),
        );
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError(
        isEditMode ? "No se pudo actualizar el ítem." : "No se pudo crear el ítem.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return createPortal(
    <div
      className={modalStyles.modalOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        className={modalStyles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-item-form-title"
      >
        <h2 id="price-item-form-title" className={modalStyles.modalTitle}>
          {isEditMode ? "Editar ítem" : "Agregar ítem"}
        </h2>
        <p className={modalStyles.modalSubtitle}>
          Completá los campos disponibles según la configuración de columnas.
        </p>

        {editableColumns.length === 0 ? (
          <p className={modalStyles.formError}>
            Esta lista no tiene columnas editables configuradas. Importá un Excel o
            configurá columnas primero.
          </p>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)}>
            {editableColumns.map((column) => (
              <div key={column.id} className={modalStyles.formField}>
                <label className={modalStyles.formLabel} htmlFor={`item-${column.id}`}>
                  {column.displayName}
                  {column.isPrimaryCode ? " (código)" : null}
                  {column.isPrice ? " (precio)" : null}
                </label>
                <input
                  id={`item-${column.id}`}
                  className={modalStyles.formInput}
                  value={values[column.internalKey] ?? ""}
                  onChange={(event) => updateValue(column.internalKey, event.target.value)}
                  disabled={isSaving}
                  inputMode={column.isPrice ? "decimal" : undefined}
                />
              </div>
            ))}

            {error ? <p className={modalStyles.formError}>{error}</p> : null}

            <div className={modalStyles.modalActions}>
              <button
                type="button"
                className={modalStyles.modalCancelButton}
                onClick={onClose}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={modalStyles.modalSaveButton}
                disabled={isSaving || editableColumns.length === 0}
              >
                {isSaving
                  ? "Guardando…"
                  : isEditMode
                    ? "Guardar cambios"
                    : "Crear ítem"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
