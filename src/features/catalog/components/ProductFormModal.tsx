"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import { formatColumnTitleForDisplay } from "@/features/catalog/utils/column-title-display";
import { isGeneratedPrimaryCodeColumn } from "@/features/catalog/utils/product-table-columns";
import { X, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ProductFormModalProps = {
  folderId: string;
  folderName: string;
  columns: ColumnListItem[];
  onClose: () => void;
  onSaved: () => void;
};

function getEditableColumns(columns: ColumnListItem[]): ColumnListItem[] {
  return columns.filter(
    (column) =>
      column.isAdminEditable &&
      !column.isReadOnly &&
      !isGeneratedPrimaryCodeColumn(column),
  );
}

function buildInitialValues(columns: ColumnListItem[]): Record<string, string> {
  const values: Record<string, string> = {};

  for (const column of columns) {
    values[column.internalKey] = "";
  }

  return values;
}

export function ProductFormModal({
  folderId,
  folderName,
  columns,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const editableColumns = useMemo(() => getEditableColumns(columns), [columns]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialValues(editableColumns),
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
      const response = await fetch(`/api/admin/folders/${folderId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payloadValues }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "No se pudo crear el producto.");
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError("No se pudo crear el producto.");
    } finally {
      setIsSaving(false);
    }
  }

  return createPortal(
    <div
      className={styles.columnEditOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        className={styles.columnEditCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
      >
        <div className={styles.columnEditHeader}>
          <div>
            <h3 id="product-form-title" className={styles.columnEditTitle}>
              Agregar producto
            </h3>
            <p className={styles.columnEditSubtitle}>
              Carpeta: {folderName}
            </p>
          </div>
          <button
            type="button"
            className={styles.columnEditClose}
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar"
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>

        {editableColumns.length === 0 ? (
          <p className={styles.columnEditError}>
            Esta carpeta no tiene columnas editables configuradas. Importá un Excel o
            configurá columnas primero.
          </p>
        ) : (
          <form className={styles.columnEditForm} onSubmit={(event) => void handleSubmit(event)}>
            {editableColumns.map((column) => (
              <label key={column.id} className={styles.columnEditField}>
                <span className={styles.columnEditLabel}>
                  {formatColumnTitleForDisplay(column.displayName)}
                  {column.isPrimaryCode ? " (código)" : null}
                  {column.isDescription ? " (descripción)" : null}
                  {column.isRequired ? null : (
                    <span className={styles.columnEditOptional}> (opcional)</span>
                  )}
                </span>
                <input
                  type="text"
                  className={styles.columnEditInput}
                  value={values[column.internalKey] ?? ""}
                  onChange={(event) => updateValue(column.internalKey, event.target.value)}
                  disabled={isSaving}
                  required={column.isRequired}
                />
              </label>
            ))}

            {error ? (
              <p className={styles.columnEditError} role="alert">
                {error}
              </p>
            ) : null}

            <div className={styles.columnEditActions}>
              <button
                type="button"
                className={styles.confirmCancelButton}
                onClick={onClose}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.confirmPrimaryButton}
                disabled={isSaving}
              >
                {isSaving ? "Guardando…" : "Crear producto"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
