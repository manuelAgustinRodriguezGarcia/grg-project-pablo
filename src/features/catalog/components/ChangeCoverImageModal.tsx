"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  removeFolderCoverImageAction,
  setFolderCoverImageAction,
} from "@/features/catalog/actions/folder.actions";
import { CATALOG_COVER_FALLBACK_SRC } from "@/features/catalog/utils/catalog-cover";
import { ICON_STROKE, Image as ImageIcon, X } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type ChangeCoverImageModalProps = {
  folderId: string;
  folderName: string;
  currentImageUrl: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
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

export function ChangeCoverImageModal({
  folderId,
  folderName,
  currentImageUrl,
  onClose,
  onSaved,
}: ChangeCoverImageModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const objectUrlRef = useRef<string | null>(null);
  const hadPersistedImage = Boolean(currentImageUrl);

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
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  function setFile(file: File) {
    if (!isAcceptedImageFile(file)) {
      setError("La imagen debe ser JPG, PNG o WebP.");
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;
    setPendingFile(file);
    setRemoveImage(false);
    setPreviewUrl(nextUrl);
    setError(null);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
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
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setFile(file);
    }
  }

  function handleRemoveImage() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPendingFile(null);
    setRemoveImage(true);
    setPreviewUrl(null);
    setError(null);
  }

  async function handleSave() {
    if (!pendingFile && !removeImage) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (removeImage && hadPersistedImage) {
        const result = await removeFolderCoverImageAction({ folderId });
        if (!result.success) {
          setError(result.error);
          return;
        }
      }

      if (pendingFile) {
        const formData = new FormData();
        formData.set("folderId", folderId);
        formData.set("file", pendingFile);
        const result = await setFolderCoverImageAction(formData);
        if (!result.success) {
          setError(result.error);
          return;
        }
      }

      await onSaved();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  const displaySrc = previewUrl || CATALOG_COVER_FALLBACK_SRC;
  const hasPreviewImage = Boolean(previewUrl);

  return createPortal(
    <div
      className={styles.confirmOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        className={styles.changeCoverModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-cover-title"
      >
        <div className={styles.changeCoverHeader}>
          <h2 id="change-cover-title" className={styles.changeCoverTitle}>
            Cambiar imagen
          </h2>
          <button
            type="button"
            className={styles.confirmCornerClose}
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar"
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>

        <p className={styles.changeCoverFolderName}>{folderName}</p>

        <div className={styles.changeCoverPreview}>
          <img
            src={displaySrc}
            alt=""
            className={
              hasPreviewImage
                ? styles.changeCoverPreviewImage
                : styles.changeCoverPreviewFallback
            }
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className={styles.columnEditHiddenInput}
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              setFile(file);
            }
            event.target.value = "";
          }}
        />

        <button
          type="button"
          className={`${styles.columnEditDropzone} ${
            isDragging ? styles.columnEditDropzoneActive : ""
          }`}
          disabled={isSaving}
          onClick={openFilePicker}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <ImageIcon
            className={styles.columnEditDropzoneIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <span className={styles.columnEditDropzoneTitle}>
            {isDragging
              ? "Suelte la imagen aquí"
              : "Arrastre una imagen o haga clic para buscarla"}
          </span>
          <span className={styles.columnEditDropzoneHint}>JPG, PNG o WebP</span>
        </button>

        {error ? (
          <p className={styles.columnEditError} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.changeCoverActions}>
          {hasPreviewImage || hadPersistedImage ? (
            <button
              type="button"
              className={styles.confirmCancelButton}
              onClick={handleRemoveImage}
              disabled={isSaving || (!hasPreviewImage && removeImage)}
            >
              Quitar imagen
            </button>
          ) : (
            <span />
          )}
          <div className={styles.changeCoverActionsEnd}>
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
              onClick={() => void handleSave()}
              disabled={isSaving || (!pendingFile && !removeImage)}
            >
              {isSaving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
