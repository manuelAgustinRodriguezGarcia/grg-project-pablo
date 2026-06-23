"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload, ICON_STROKE } from "@/shared/icons";
import { ImportExternalImagesPanel } from "./ImportExternalImagesPanel";
import type { ExternalImageSelection } from "@/features/imports/utils/external-images";
import styles from "./ImportWizard.module.scss";

const ACCEPTED_EXTENSIONS = [".xlsx", ".xlsm"];
const ACCEPT_ATTR = ".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type ImportStepUploadProps = {
  file: File | null;
  externalImages: ExternalImageSelection;
  disabled: boolean;
  onFileSelected: (file: File | null) => void;
  onExternalImagesChange: (selection: ExternalImageSelection) => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

function hasValidExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function ImportStepUpload({
  file,
  externalImages,
  disabled,
  onFileSelected,
  onExternalImagesChange,
}: ImportStepUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function pickFromList(files: FileList | null) {
    const selected = files?.[0] ?? null;
    if (selected && !hasValidExtension(selected.name)) {
      onFileSelected(null);
      return;
    }
    onFileSelected(selected);
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) {
      return;
    }
    pickFromList(event.dataTransfer.files);
  }

  return (
    <div>
      <p className={styles.stepIntro}>
        Subí un archivo de Excel (.xlsx o .xlsm). Vamos a analizar sus hojas
        para que puedas elegir cuál importar.
      </p>

      <button
        type="button"
        className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        disabled={disabled}
      >
        <span className={styles.dropZoneIcon}>
          <Upload strokeWidth={ICON_STROKE} aria-hidden />
        </span>
        <span className={styles.dropZoneTitle}>
          Arrastrá tu archivo o hacé clic para buscarlo
        </span>
        <span className={styles.dropZoneHint}>Formatos admitidos: .xlsx, .xlsm</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        className={styles.hiddenInput}
        accept={ACCEPT_ATTR}
        onChange={(event) => pickFromList(event.target.files)}
        disabled={disabled}
      />

      {file ? (
        <div className={`${styles.fileCard} ${styles.fileCardReady}`}>
          <span className={styles.fileIcon}>
            <FileSpreadsheet strokeWidth={ICON_STROKE} aria-hidden />
          </span>
          <span className={styles.fileMeta}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileSize}>{formatSize(file.size)}</span>
            <span className={styles.fileReadyNote}>Se importará al continuar</span>
          </span>
          <button
            type="button"
            className={styles.fileRemove}
            onClick={() => onFileSelected(null)}
            disabled={disabled}
          >
            Quitar
          </button>
        </div>
      ) : null}

      <ImportExternalImagesPanel
        selection={externalImages}
        disabled={disabled}
        onChange={onExternalImagesChange}
      />
    </div>
  );
}
