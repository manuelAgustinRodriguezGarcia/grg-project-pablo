"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PriceColumnListItem } from "@/features/prices/types/price-column.types";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";

type PriceColumnEditModalProps = {
  priceListId: string;
  column: PriceColumnListItem;
  onClose: () => void;
  onSaved: (column: PriceColumnListItem) => void;
  onDeleted?: () => void;
};

export function PriceColumnEditModal({
  priceListId,
  column,
  onClose,
  onSaved,
  onDeleted,
}: PriceColumnEditModalProps) {
  const [displayName, setDisplayName] = useState(column.displayName);
  const [visibleToNormalUser, setVisibleToNormalUser] = useState(
    column.visibleToNormalUser,
  );
  const [isSearchable, setIsSearchable] = useState(column.isSearchable);
  const [isFilterable, setIsFilterable] = useState(column.isFilterable);
  const [isPrimaryCode, setIsPrimaryCode] = useState(column.isPrimaryCode);
  const [isDescription, setIsDescription] = useState(column.isDescription);
  const [isPrice, setIsPrice] = useState(column.isPrice);
  const [helpText, setHelpText] = useState(column.helpText ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) {
      setError("El nombre visible es obligatorio.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/price-lists/${priceListId}/columns`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: column.id,
          displayName: trimmedDisplayName,
          visibleToNormalUser,
          isSearchable,
          isFilterable,
          isPrimaryCode,
          isDescription,
          isPrice,
          helpText: helpText.trim() || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | PriceColumnListItem
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(
          payload && "error" in payload && payload.error
            ? payload.error
            : "No se pudo guardar la columna.",
        );
        return;
      }

      onSaved(payload as PriceColumnListItem);
    } catch {
      setError("No se pudo guardar la columna.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDeleted || !window.confirm(`¿Eliminar la columna «${column.displayName}»?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/price-lists/${priceListId}/columns/${column.id}`,
        { method: "DELETE" },
      );

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? "No se pudo eliminar la columna.");
        return;
      }

      onDeleted();
      onClose();
    } catch {
      setError("No se pudo eliminar la columna.");
    } finally {
      setIsDeleting(false);
    }
  }

  const isBusy = isSaving || isDeleting;

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
        aria-labelledby="price-column-form-title"
      >
        <h2 id="price-column-form-title" className={modalStyles.modalTitle}>
          Editar columna
        </h2>
        <p className={modalStyles.modalSubtitle}>
          Columna original: <strong>{column.originalName}</strong>
        </p>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="price-column-display-name">
              Nombre visible
            </label>
            <input
              id="price-column-display-name"
              className={modalStyles.formInput}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={200}
              required
              autoFocus
              disabled={isBusy}
            />
          </div>

          <div className={modalStyles.toggleGrid}>
            <label className={modalStyles.toggleField}>
              <input
                type="checkbox"
                checked={isPrimaryCode}
                onChange={(event) => setIsPrimaryCode(event.target.checked)}
                disabled={isBusy}
              />
              Código principal
            </label>
            <label className={modalStyles.toggleField}>
              <input
                type="checkbox"
                checked={isDescription}
                onChange={(event) => setIsDescription(event.target.checked)}
                disabled={isBusy}
              />
              Descripción
            </label>
            <label className={modalStyles.toggleField}>
              <input
                type="checkbox"
                checked={isPrice}
                onChange={(event) => setIsPrice(event.target.checked)}
                disabled={isBusy}
              />
              Precio
            </label>
            <label className={modalStyles.toggleField}>
              <input
                type="checkbox"
                checked={visibleToNormalUser}
                onChange={(event) => setVisibleToNormalUser(event.target.checked)}
                disabled={isBusy}
              />
              Visible para consulta
            </label>
            <label className={modalStyles.toggleField}>
              <input
                type="checkbox"
                checked={isSearchable}
                onChange={(event) => setIsSearchable(event.target.checked)}
                disabled={isBusy}
              />
              Buscable
            </label>
            <label className={modalStyles.toggleField}>
              <input
                type="checkbox"
                checked={isFilterable}
                onChange={(event) => setIsFilterable(event.target.checked)}
                disabled={isBusy}
              />
              Filtrable
            </label>
          </div>

          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="price-column-help">
              Texto de ayuda (opcional)
            </label>
            <textarea
              id="price-column-help"
              className={modalStyles.formTextarea}
              value={helpText}
              onChange={(event) => setHelpText(event.target.value)}
              maxLength={2000}
              disabled={isBusy}
            />
          </div>

          {error ? <p className={modalStyles.formError}>{error}</p> : null}

          <div className={modalStyles.modalActions}>
            {onDeleted ? (
              <button
                type="button"
                className={modalStyles.modalCancelButton}
                onClick={() => void handleDelete()}
                disabled={isBusy}
                style={{ marginRight: "auto", color: "var(--color-danger, #b91c1c)" }}
              >
                {isDeleting ? "Eliminando…" : "Eliminar columna"}
              </button>
            ) : null}
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
              disabled={isBusy}
            >
              {isSaving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
