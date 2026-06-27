"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { updateColumnAction } from "@/features/catalog/actions/column.actions";
import { deleteColumnHelpImageAction } from "@/features/catalog/actions/column-help.actions";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import { uploadColumnHelpImage } from "@/features/catalog/utils/column-help.client";
import { formatColumnTitleForDisplay } from "@/features/catalog/utils/column-title-display";
import { Upload, X, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const HELP_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

type ColumnEditModalProps = {
  column: ColumnListItem;
  onClose: () => void;
  onSaved: (column: ColumnListItem) => void;
};

export function ColumnEditModal({ column, onClose, onSaved }: ColumnEditModalProps) {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const helpTextRef = useRef<HTMLTextAreaElement>(null);
  const [displayName, setDisplayName] = useState(() =>
    formatColumnTitleForDisplay(column.displayName),
  );
  const [helpText, setHelpText] = useState(column.helpText ?? "");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    column.helpImagePreviewUrl ?? column.helpImageFullUrl,
  );
  const [imageRemoved, setImageRemoved] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const textarea = helpTextRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [helpText]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  useEffect(() => {
    if (!pendingFile) {
      return;
    }

    const objectUrl = URL.createObjectURL(pendingFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [pendingFile]);

  function handleSelectFile(file: File | null) {
    if (!file) {
      return;
    }

    setPendingFile(file);
    setImageRemoved(false);
    setError(null);
  }

  function handleRemoveImage() {
    setPendingFile(null);
    setPreviewUrl(null);
    setImageRemoved(true);
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) {
      setError("El título visible es obligatorio.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const normalizedHelpText = helpText.trim();

    try {
      const updateResult = await updateColumnAction({
        id: column.id,
        displayName: trimmedDisplayName,
        helpText: normalizedHelpText.length > 0 ? normalizedHelpText : null,
      });

      if (!updateResult.success) {
        setError(updateResult.error);
        return;
      }

      let savedColumn = updateResult.data;
      const hadHelpImage = Boolean(
        column.helpImagePreviewUrl ?? column.helpImageFullUrl ?? column.hasContextualHelp,
      );

      if (pendingFile) {
        const uploadResult = await uploadColumnHelpImage(column.id, pendingFile);
        if (!uploadResult.success) {
          setError(uploadResult.error);
          onSaved(savedColumn);
          return;
        }

        savedColumn = uploadResult.data;
      } else if (imageRemoved && hadHelpImage) {
        const deleteResult = await deleteColumnHelpImageAction({ columnId: column.id });
        if (!deleteResult.success) {
          setError(deleteResult.error);
          onSaved(savedColumn);
          return;
        }

        savedColumn = deleteResult.data;
      }

      onSaved(savedColumn);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  const displayNameEmpty = displayName.trim().length === 0;

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
        aria-labelledby={`${formId}-title`}
      >
        <div className={styles.columnEditHeader}>
          <h3 id={`${formId}-title`} className={styles.columnEditTitle}>
            Editar columna
          </h3>
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

        <form id={formId} className={styles.columnEditForm} onSubmit={handleSubmit}>
          <div className={styles.columnEditField}>
            <span className={styles.columnEditLabel}>Título original</span>
            <p className={styles.columnEditReadonlyValue}>
              {formatColumnTitleForDisplay(column.originalName)}
            </p>
          </div>

          <label className={styles.columnEditField}>
            <span className={styles.columnEditLabel}>Título visible</span>
            <input
              type="text"
              className={styles.columnEditInput}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={isSaving}
              required
            />
          </label>

          <label className={styles.columnEditField}>
            <span className={styles.columnEditLabel}>
              Descripción <span className={styles.columnEditOptional}>(opcional)</span>
            </span>
            <textarea
              ref={helpTextRef}
              className={styles.columnEditTextarea}
              value={helpText}
              onChange={(event) => setHelpText(event.target.value)}
              disabled={isSaving}
              rows={1}
              placeholder="Texto de ayuda para la cabecera de la columna"
            />
          </label>

          <div className={styles.columnEditField}>
            <span className={styles.columnEditLabel}>
              Imagen de descripción{" "}
              <span className={styles.columnEditOptional}>(opcional)</span>
            </span>

            {previewUrl ? (
              <div className={styles.columnEditImagePreview}>
                <img
                  src={previewUrl}
                  alt={column.helpImageAltText ?? "Vista previa de imagen de ayuda"}
                  className={styles.columnEditImagePreviewImg}
                />
                <div className={styles.columnEditImageActions}>
                  <button
                    type="button"
                    className={styles.columnEditImageReplace}
                    onClick={openFilePicker}
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
                className={`${styles.columnEditDropzone} ${isDragging ? styles.columnEditDropzoneActive : ""}`}
                onClick={openFilePicker}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!isSaving) {
                    setIsDragging(true);
                  }
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  if (isSaving) {
                    return;
                  }

                  const file = event.dataTransfer.files.item(0);
                  handleSelectFile(file);
                }}
                disabled={isSaving}
              >
                <Upload className={styles.columnEditDropzoneIcon} strokeWidth={ICON_STROKE} aria-hidden />
                <span className={styles.columnEditDropzoneTitle}>
                  Arrastre una imagen o haga clic para buscarla
                </span>
                <span className={styles.columnEditDropzoneHint}>JPG, PNG, WebP o GIF</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              className={styles.columnEditHiddenInput}
              accept={HELP_IMAGE_ACCEPT}
              onChange={(event) => {
                const file = event.target.files?.item(0) ?? null;
                handleSelectFile(file);
              }}
              disabled={isSaving}
            />
          </div>

          {error ? (
            <p className={styles.columnEditError} role="alert">
              {error}
            </p>
          ) : null}
        </form>

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
            form={formId}
            className={styles.confirmPrimaryButton}
            disabled={isSaving || displayNameEmpty}
          >
            {isSaving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
