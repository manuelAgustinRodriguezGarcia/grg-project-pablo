"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2, Upload, ICON_STROKE } from "@/shared/icons";
import {
  formatExternalFileSize,
  validateExternalImageFile,
  type ExternalImageSelection,
} from "@/features/imports/utils/external-images";
import styles from "./ImportWizard.module.scss";

const ACCEPT_ATTR =
  ".zip,.jpg,.jpeg,.png,.webp,application/zip,image/jpeg,image/png,image/webp";

type ImportExternalImagesPanelProps = {
  selection: ExternalImageSelection;
  disabled: boolean;
  onChange: (selection: ExternalImageSelection) => void;
};

function pickFiles(
  files: FileList | null,
  current: ExternalImageSelection,
): { selection: ExternalImageSelection; error: string | null } {
  if (!files || files.length === 0) {
    return { selection: current, error: null };
  }

  let zipFile = current.zipFile;
  const imageFiles = [...current.imageFiles];

  for (const file of Array.from(files)) {
    const validationError = validateExternalImageFile(file);
    if (validationError) {
      return { selection: current, error: validationError };
    }

    if (file.name.toLowerCase().endsWith(".zip")) {
      zipFile = file;
      continue;
    }

    imageFiles.push(file);
  }

  return {
    selection: { zipFile, imageFiles },
    error: null,
  };
}

export function ImportExternalImagesPanel({
  selection,
  disabled,
  onChange,
}: ImportExternalImagesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const hasSelection = Boolean(selection.zipFile) || selection.imageFiles.length > 0;

  function handlePick(files: FileList | null) {
    const result = pickFiles(files, selection);
    if (result.error) {
      setSelectionError(result.error);
      return;
    }

    setSelectionError(null);
    onChange(result.selection);
  }

  return (
    <div className={styles.externalImagesSection}>
      <div className={styles.externalImagesHeader}>
        <span className={styles.externalImagesTitle}>
          <Camera strokeWidth={ICON_STROKE} aria-hidden />
          Imágenes externas (opcional)
        </span>
        {hasSelection ? (
          <span className={styles.externalImagesReadyBadge}>
            <CheckCircle2 strokeWidth={ICON_STROKE} aria-hidden />
            Listo para importar
          </span>
        ) : null}
      </div>

      <p className={styles.externalImagesHint}>
        Podés adjuntar un ZIP o imágenes sueltas (.jpg, .png, .webp). Se subirán junto
        con el Excel al continuar y se asociarán por código de imagen.
      </p>

      {selectionError ? (
        <p className={styles.externalImagesError}>{selectionError}</p>
      ) : null}

      {!hasSelection ? (
        <button
          type="button"
          className={styles.externalImagesDropZone}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Upload strokeWidth={ICON_STROKE} aria-hidden />
          <span>Agregar ZIP o imágenes</span>
        </button>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        className={styles.hiddenInput}
        accept={ACCEPT_ATTR}
        multiple
        onChange={(event) => {
          handlePick(event.target.files);
          event.target.value = "";
        }}
        disabled={disabled}
      />

      {selection.zipFile ? (
        <div className={`${styles.fileCard} ${styles.fileCardReady}`}>
          <span className={`${styles.fileIcon} ${styles.fileIconImages}`}>
            <Camera strokeWidth={ICON_STROKE} aria-hidden />
          </span>
          <span className={styles.fileMeta}>
            <span className={styles.fileName}>{selection.zipFile.name}</span>
            <span className={styles.fileSize}>
              ZIP · {formatExternalFileSize(selection.zipFile.size)}
            </span>
            <span className={styles.fileReadyNote}>Se importará al continuar</span>
          </span>
          <button
            type="button"
            className={styles.fileRemove}
            onClick={() => onChange({ ...selection, zipFile: null })}
            disabled={disabled}
          >
            Quitar
          </button>
        </div>
      ) : null}

      {selection.imageFiles.map((image, index) => (
        <div key={`${image.name}-${index}`} className={`${styles.fileCard} ${styles.fileCardReady}`}>
          <span className={`${styles.fileIcon} ${styles.fileIconImages}`}>
            <Camera strokeWidth={ICON_STROKE} aria-hidden />
          </span>
          <span className={styles.fileMeta}>
            <span className={styles.fileName}>{image.name}</span>
            <span className={styles.fileSize}>{formatExternalFileSize(image.size)}</span>
            <span className={styles.fileReadyNote}>Se importará al continuar</span>
          </span>
          <button
            type="button"
            className={styles.fileRemove}
            onClick={() =>
              onChange({
                ...selection,
                imageFiles: selection.imageFiles.filter((_, itemIndex) => itemIndex !== index),
              })
            }
            disabled={disabled}
          >
            Quitar
          </button>
        </div>
      ))}

      {hasSelection ? (
        <button
          type="button"
          className={styles.externalImagesAddMore}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Upload strokeWidth={ICON_STROKE} aria-hidden />
          Agregar más archivos
        </button>
      ) : null}
    </div>
  );
}
