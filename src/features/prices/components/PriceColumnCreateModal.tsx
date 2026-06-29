"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PriceColumnListItem } from "@/features/prices/types/price-column.types";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";

type PriceColumnCreateModalProps = {
  priceListId: string;
  onClose: () => void;
  onCreated: (column: PriceColumnListItem) => void;
};

function slugifyInternalKey(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

export function PriceColumnCreateModal({
  priceListId,
  onClose,
  onCreated,
}: PriceColumnCreateModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [internalKey, setInternalKey] = useState("");
  const [internalKeyTouched, setInternalKeyTouched] = useState(false);
  const [dataType, setDataType] = useState("TEXT");
  const [isPrimaryCode, setIsPrimaryCode] = useState(false);
  const [isDescription, setIsDescription] = useState(false);
  const [isPrice, setIsPrice] = useState(false);
  const [visibleToNormalUser, setVisibleToNormalUser] = useState(true);
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

  function handleDisplayNameChange(value: string) {
    setDisplayName(value);
    if (!internalKeyTouched) {
      setInternalKey(slugifyInternalKey(value));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedDisplayName = displayName.trim();
    const trimmedInternalKey = internalKey.trim();

    if (!trimmedDisplayName) {
      setError("El nombre visible es obligatorio.");
      return;
    }

    if (!trimmedInternalKey) {
      setError("La clave interna es obligatoria.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/price-lists/${priceListId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: trimmedDisplayName,
          displayName: trimmedDisplayName,
          internalKey: trimmedInternalKey,
          dataType,
          visibleToNormalUser,
          isAdminEditable: true,
          isPrimaryCode,
          isDescription,
          isPrice,
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
            : "No se pudo crear la columna.",
        );
        return;
      }

      const column = payload as {
        id: string;
        priceListId: string;
        originalName: string;
        displayName: string;
        internalKey: string;
        dataType: string;
        order: number;
        visibleToNormalUser: boolean;
        isSearchable: boolean;
        isFilterable: boolean;
        isAdminEditable: boolean;
        isReadOnly: boolean;
        isPrimaryCode: boolean;
        isDescription: boolean;
        isPrice: boolean;
        helpText: string | null;
      };

      onCreated({
        id: column.id,
        priceListId: column.priceListId,
        originalName: column.originalName,
        displayName: column.displayName,
        internalKey: column.internalKey,
        dataType: column.dataType,
        order: column.order,
        visibleToNormalUser: column.visibleToNormalUser,
        isSearchable: column.isSearchable,
        isFilterable: column.isFilterable,
        isAdminEditable: column.isAdminEditable,
        isReadOnly: column.isReadOnly,
        isPrimaryCode: column.isPrimaryCode,
        isDescription: column.isDescription,
        isPrice: column.isPrice,
        helpText: column.helpText,
      });
      onClose();
    } catch {
      setError("No se pudo crear la columna.");
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
        aria-labelledby="price-column-create-title"
      >
        <h2 id="price-column-create-title" className={modalStyles.modalTitle}>
          Agregar columna
        </h2>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="price-column-create-display">
              Nombre visible
            </label>
            <input
              id="price-column-create-display"
              className={modalStyles.formInput}
              value={displayName}
              onChange={(event) => handleDisplayNameChange(event.target.value)}
              maxLength={200}
              required
              autoFocus
              disabled={isSaving}
            />
          </div>

          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="price-column-create-key">
              Clave interna
            </label>
            <input
              id="price-column-create-key"
              className={modalStyles.formInput}
              value={internalKey}
              onChange={(event) => {
                setInternalKeyTouched(true);
                setInternalKey(event.target.value);
              }}
              maxLength={120}
              pattern="[a-z0-9_]+"
              required
              disabled={isSaving}
            />
          </div>

          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="price-column-create-type">
              Tipo de dato
            </label>
            <select
              id="price-column-create-type"
              className={modalStyles.formInput}
              value={dataType}
              onChange={(event) => setDataType(event.target.value)}
              disabled={isSaving}
            >
              <option value="TEXT">Texto</option>
              <option value="NUMBER">Número</option>
              <option value="BOOLEAN">Booleano</option>
              <option value="DATE">Fecha</option>
              <option value="UNKNOWN">Desconocido</option>
            </select>
          </div>

          <div className={modalStyles.toggleGrid}>
            <label className={modalStyles.toggleField}>
              <input
                type="checkbox"
                checked={isPrimaryCode}
                onChange={(event) => setIsPrimaryCode(event.target.checked)}
                disabled={isSaving}
              />
              Código principal
            </label>
            <label className={modalStyles.toggleField}>
              <input
                type="checkbox"
                checked={isDescription}
                onChange={(event) => setIsDescription(event.target.checked)}
                disabled={isSaving}
              />
              Descripción
            </label>
            <label className={modalStyles.toggleField}>
              <input
                type="checkbox"
                checked={isPrice}
                onChange={(event) => setIsPrice(event.target.checked)}
                disabled={isSaving}
              />
              Precio
            </label>
            <label className={modalStyles.toggleField}>
              <input
                type="checkbox"
                checked={visibleToNormalUser}
                onChange={(event) => setVisibleToNormalUser(event.target.checked)}
                disabled={isSaving}
              />
              Visible para consulta
            </label>
          </div>

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
            <button type="submit" className={modalStyles.modalSaveButton} disabled={isSaving}>
              {isSaving ? "Creando…" : "Crear columna"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
