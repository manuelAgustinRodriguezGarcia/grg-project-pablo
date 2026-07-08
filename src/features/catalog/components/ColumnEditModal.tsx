"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { updateColumnAction } from "@/features/catalog/actions/column.actions";
import { deleteColumnHelpImageAction } from "@/features/catalog/actions/column-help.actions";
import { uploadColumnHelpImage } from "@/features/catalog/utils/column-help.client";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import { Image, X, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ColumnEditModalProps = {
  column: ColumnListItem;
  onClose: () => void;
  onSaved: () => void;
};

export function ColumnEditModal({ column, onClose, onSaved }: ColumnEditModalProps) {
  const [displayName, setDisplayName] = useState(column.displayName);
  const [helpText, setHelpText] = useState(column.helpText ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    column.helpImagePreviewUrl ?? column.helpImageFullUrl ?? null,
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = titleTextareaRef.current;
    if (element) {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [displayName]);

  const hadImage = Boolean(column.helpImagePreviewUrl ?? column.helpImageFullUrl);

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

  function handleSelectImage(file: File | null) {
    if (!file) {
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
    setRemoveImage(false);
  }

  function handleRemoveImage() {
    setPreviewUrl(null);
    setPendingFile(null);
    setRemoveImage(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const nextDisplayName = displayName.trim();
    if (!nextDisplayName) {
      setError("El título de la columna no puede estar vacío.");
      setIsSaving(false);
      return;
    }

    const nextHelpText = helpText.trim();

    try {
      const displayNameChanged = nextDisplayName !== column.displayName;
      const helpTextChanged = nextHelpText !== (column.helpText ?? "");

      if (displayNameChanged || helpTextChanged) {
        const result = await updateColumnAction({
          id: column.id,
          ...(displayNameChanged ? { displayName: nextDisplayName } : {}),
          ...(helpTextChanged ? { helpText: nextHelpText || null } : {}),
        });

        if (!result.success) {
          setError(result.error);
          return;
        }
      }

      if (pendingFile) {
        const result = await uploadColumnHelpImage(column.id, pendingFile);
        if (!result.success) {
          setError(result.error);
          return;
        }
      } else if (removeImage && hadImage) {
        const result = await deleteColumnHelpImageAction({ columnId: column.id });
        if (!result.success) {
          setError(result.error);
          return;
        }
      }

      onSaved();
      onClose();
    } catch {
      setError("No se pudo guardar la columna.");
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
        className={`${styles.columnEditCard} ${styles.columnEditCardWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="column-edit-title"
      >
        <div className={styles.columnEditHeader}>
          <div>
            <h3 id="column-edit-title" className={styles.columnEditTitle}>
              Editar columna
            </h3>
            <p className={styles.columnEditSubtitle}>
              Título Original: {column.originalName}
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

        <form className={styles.columnEditForm} onSubmit={(event) => void handleSubmit(event)}>
          <label className={styles.columnEditField}>
            <span className={styles.columnEditLabel}>Título de la columna</span>
            <textarea
              ref={titleTextareaRef}
              className={styles.columnEditTitleTextarea}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={isSaving}
              maxLength={200}
              rows={1}
              aria-label="Título de la columna"
            />
          </label>

          <div className={styles.columnEditField}>
            <span className={styles.columnEditLabel}>Imagen descriptiva</span>
            {previewUrl ? (
              <div className={styles.columnEditImagePreview}>
                <img
                  src={previewUrl}
                  alt=""
                  className={styles.columnEditImagePreviewImg}
                />
                <div className={styles.columnEditImageActions}>
                  <button
                    type="button"
                    className={styles.columnEditImageReplace}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                  >
                    Reemplazar
                  </button>
                  <button
                    type="button"
                    className={styles.columnEditImageRemove}
                    onClick={handleRemoveImage}
                    disabled={isSaving}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={styles.columnEditDropzone}
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
              >
                <Image
                  className={styles.columnEditDropzoneIcon}
                  strokeWidth={ICON_STROKE}
                  aria-hidden
                />
                <span className={styles.columnEditDropzoneTitle}>Agregar imagen</span>
                <span className={styles.columnEditDropzoneHint}>JPG, PNG o WebP</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={styles.columnEditHiddenInput}
              onChange={(event) => handleSelectImage(event.target.files?.[0] ?? null)}
            />
          </div>

          <label className={styles.columnEditField}>
            <span className={styles.columnEditLabel}>Descripción de columna</span>
            <textarea
              className={styles.columnEditTextarea}
              value={helpText}
              onChange={(event) => setHelpText(event.target.value)}
              disabled={isSaving}
              maxLength={2000}
              rows={3}
              placeholder="Descripción o aclaración para esta columna"
            />
          </label>

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
              {isSaving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
