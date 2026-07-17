"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { updateColumnAction } from "@/features/catalog/actions/column.actions";
import {
  deleteColumnHelpImage,
  uploadColumnHelpImage,
} from "@/features/catalog/utils/column-help.client";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import { Image, X, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type ColumnEditModalProps = {
  column: ColumnListItem;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onNativeFilePickerOpen?: () => void;
};

function isAcceptedImageFile(file: File): boolean {
  if (ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return true;
  }

  const lower = file.name.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp")
  );
}

export function ColumnEditModal({
  column,
  onClose,
  onSaved,
  onNativeFilePickerOpen,
}: ColumnEditModalProps) {
  const [displayName, setDisplayName] = useState(column.displayName);
  const [helpText, setHelpText] = useState(column.helpText ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    column.helpImagePreviewUrl ?? column.helpImageFullUrl ?? null,
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const ignoreOverlayCloseRef = useRef(false);
  const dragDepthRef = useRef(0);
  const hadPersistedImageRef = useRef(
    Boolean(column.helpImagePreviewUrl ?? column.helpImageFullUrl),
  );

  useEffect(() => {
    const element = titleTextareaRef.current;
    if (element) {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [displayName]);

  const nextDisplayName = displayName.trim();
  const nextHelpText = helpText.trim();
  const displayNameChanged = nextDisplayName !== column.displayName;
  const helpTextChanged = nextHelpText !== (column.helpText ?? "").trim();
  const hasChanges =
    displayNameChanged ||
    helpTextChanged ||
    pendingFile !== null ||
    removeImage;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving && !ignoreOverlayCloseRef.current) {
        onClose();
      }
    }

    function handleWindowFocus() {
      window.setTimeout(() => {
        ignoreOverlayCloseRef.current = false;
      }, 400);
    }

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isSaving, onClose]);

  function openFilePicker() {
    const input = fileInputRef.current;
    if (!input || isSaving) {
      return;
    }

    ignoreOverlayCloseRef.current = true;
    onNativeFilePickerOpen?.();
    input.value = "";
    input.click();
  }

  function handleSelectImage(file: File | null) {
    ignoreOverlayCloseRef.current = false;

    if (!file) {
      return;
    }

    if (!isAcceptedImageFile(file)) {
      setError("La imagen debe ser JPG, PNG o WebP.");
      return;
    }

    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
    setRemoveImage(false);
  }

  function handleRemoveImage() {
    setPreviewUrl(null);
    setPendingFile(null);
    setRemoveImage(hadPersistedImageRef.current);
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (isSaving) {
      return;
    }

    dragDepthRef.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!isSaving) {
      event.dataTransfer.dropEffect = "copy";
    }
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);

    if (isSaving) {
      return;
    }

    handleSelectImage(event.dataTransfer.files?.[0] ?? null);
  }

  async function handleSave() {
    if (!hasChanges || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    if (!nextDisplayName) {
      setError("El título de la columna no puede estar vacío.");
      setIsSaving(false);
      return;
    }

    try {
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
      } else if (removeImage && hadPersistedImageRef.current) {
        const result = await deleteColumnHelpImage(column.id);
        if (!result.success && result.code !== "HELP_IMAGE_NOT_FOUND") {
          setError(result.error);
          return;
        }
      }

      await onSaved();
      onClose();
    } catch {
      setError("No se pudo guardar la columna.");
    } finally {
      setIsSaving(false);
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={styles.columnEditOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSaving &&
          !ignoreOverlayCloseRef.current
        ) {
          onClose();
        }
      }}
    >
      <div
        className={`${styles.columnEditCard} ${styles.columnEditCardWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="column-edit-title"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
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

        <form
          className={styles.columnEditForm}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className={styles.columnEditHiddenInput}
              tabIndex={-1}
              disabled={isSaving}
              aria-hidden
              onChange={(event) => {
                handleSelectImage(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
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
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openFilePicker();
                    }}
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
                className={`${styles.columnEditDropzone} ${
                  isDragging ? styles.columnEditDropzoneActive : ""
                }`}
                disabled={isSaving}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openFilePicker();
                }}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Image
                  className={styles.columnEditDropzoneIcon}
                  strokeWidth={ICON_STROKE}
                  aria-hidden
                />
                <span className={styles.columnEditDropzoneTitle}>
                  {isDragging
                    ? "Soltá la imagen aquí"
                    : "Arrastrá una imagen o hacé clic para buscarla"}
                </span>
                <span className={styles.columnEditDropzoneHint}>JPG, PNG o WebP</span>
              </button>
            )}
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
              type="button"
              className={styles.confirmPrimaryButton}
              disabled={isSaving || !hasChanges}
              onClick={() => {
                void handleSave();
              }}
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
