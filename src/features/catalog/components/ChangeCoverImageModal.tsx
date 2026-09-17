"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  createFolderAction,
  removeFolderCoverImageAction,
  setFolderCoverImageAction,
  updateFolderAction,
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
  folderId?: string;
  folderName?: string;
  currentImageUrl?: string | null;
  createCatalogId?: string;
  allowRename?: boolean;
  onClose: () => void;
  onSaved: (payload: {
    previousName: string;
    name: string;
    folderId: string;
    created?: boolean;
  }) => void | Promise<void>;
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
  folderName = "",
  currentImageUrl = null,
  createCatalogId,
  allowRename = false,
  onClose,
  onSaved,
}: ChangeCoverImageModalProps) {
  const isCreateMode = Boolean(createCatalogId);
  const [nameDraft, setNameDraft] = useState(folderName);
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

  const trimmedName = nameDraft.trim();
  const nameChanged =
    !isCreateMode &&
    allowRename &&
    trimmedName.length > 0 &&
    trimmedName !== folderName.trim();
  const imageChanged = Boolean(pendingFile) || removeImage;
  const canSave = isCreateMode
    ? trimmedName.length > 0
    : (nameChanged || imageChanged) &&
      (!allowRename || trimmedName.length > 0);

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
    if (!canSave) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (isCreateMode && createCatalogId) {
        const createResult = await createFolderAction({
          catalogId: createCatalogId,
          name: trimmedName,
        });
        if (!createResult.success) {
          setError(createResult.error);
          return;
        }

        const createdId = createResult.data.id;
        let finalName = createResult.data.name;

        if (pendingFile) {
          const formData = new FormData();
          formData.set("folderId", createdId);
          formData.set("file", pendingFile);
          const imageResult = await setFolderCoverImageAction(formData);
          if (!imageResult.success) {
            setError(imageResult.error);
            await onSaved({
              previousName: "",
              name: finalName,
              folderId: createdId,
              created: true,
            });
            onClose();
            return;
          }
        }

        await onSaved({
          previousName: "",
          name: finalName,
          folderId: createdId,
          created: true,
        });
        onClose();
        return;
      }

      if (!folderId) {
        setError("No se encontró la carpeta.");
        return;
      }

      let nextName = folderName;
      let activeFolderId = folderId;

      if (nameChanged) {
        const result = await updateFolderAction({
          id: folderId,
          name: trimmedName,
        });
        if (!result.success) {
          setError(result.error);
          return;
        }
        nextName = result.data.name;
      }

      if (removeImage && hadPersistedImage) {
        const result = await removeFolderCoverImageAction({ folderId: activeFolderId });
        if (!result.success) {
          setError(result.error);
          return;
        }
      }

      if (pendingFile) {
        const formData = new FormData();
        formData.set("folderId", activeFolderId);
        formData.set("file", pendingFile);
        const result = await setFolderCoverImageAction(formData);
        if (!result.success) {
          setError(result.error);
          return;
        }
      }

      await onSaved({
        previousName: folderName,
        name: nextName,
        folderId: activeFolderId,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  const displaySrc = previewUrl || CATALOG_COVER_FALLBACK_SRC;
  const hasPreviewImage = Boolean(previewUrl);
  const showNameField = isCreateMode || allowRename;
  const title = isCreateMode
    ? "Nueva carpeta"
    : allowRename
      ? "Editar carpeta"
      : "Cambiar imagen";

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
            {title}
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

        {showNameField ? (
          <label className={styles.changeCoverNameField}>
            <span className={styles.changeCoverNameLabel}>Nombre</span>
            <input
              className={styles.confirmInput}
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              maxLength={200}
              autoFocus
              disabled={isSaving}
              aria-label="Nombre de la carpeta"
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSave && !isSaving) {
                  event.preventDefault();
                  void handleSave();
                }
              }}
            />
          </label>
        ) : (
          <p className={styles.changeCoverFolderName}>{folderName}</p>
        )}

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
              disabled={isSaving || !canSave}
            >
              {isSaving
                ? "Guardando…"
                : isCreateMode
                  ? "Crear carpeta"
                  : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
