"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ImportJobStatusBadge } from "@/features/files/components/ImportJobStatusBadge";
import { UploadedFileStatusBadge } from "@/features/files/components/UploadedFileStatusBadge";
import {
  IMPORT_ACTION_TYPE_LABELS,
} from "@/features/files/data/status-labels";
import type { UploadedFileDetail } from "@/features/files/types/uploaded-file.types";
import { formatAdminDateTime } from "@/features/files/utils/format-admin-datetime";
import { formatFileSize } from "@/features/files/utils/format-file-size";
import {
  formatDestinationSummary,
  formatDestinationTypeLabel,
  formatImportMetrics,
} from "@/features/files/utils/format-destination-summary";
import {
  FileDown,
  FileSpreadsheet,
  ICON_STROKE,
  RefreshCcw,
  Trash2,
  X,
} from "@/shared/icons";
import styles from "@/features/files/styles/FilesManager.module.scss";

type UploadedFileDetailModalProps = {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  detail: UploadedFileDetail | null;
  isBusy: boolean;
  actionError: string | null;
  onClose: () => void;
  onDownload: () => void;
  onReprocess: () => void;
  onDelete: () => void;
  onViewReport: (jobId?: string) => void;
};

export function UploadedFileDetailModal({
  isOpen,
  isLoading,
  error,
  detail,
  isBusy,
  actionError,
  onClose,
  onDownload,
  onReprocess,
  onDelete,
  onViewReport,
}: UploadedFileDetailModalProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBusy, isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const latestDestination = detail ? formatDestinationSummary(detail.latestJob) : null;

  return createPortal(
    <div
      className={styles.modalOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        className={`${styles.modalCard} ${styles.modalCardWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.modalHeader}>
          <div>
            <h2 id={titleId} className={styles.modalTitle}>
              {detail?.originalName ?? "Detalle del archivo"}
            </h2>
            {detail ? (
              <p className={styles.modalSubtitle}>
                {detail.extension ? `.${detail.extension}` : "Sin extensión"} ·{" "}
                {formatFileSize(detail.sizeBytes)}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
            aria-label="Cerrar detalle"
            disabled={isBusy || isLoading}
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </header>

        <div className={styles.modalBody}>
          {isLoading ? (
            <div className={styles.modalLoading} role="status" aria-live="polite">
              <RefreshCcw
                strokeWidth={ICON_STROKE}
                aria-hidden
                className={styles.modalLoadingIcon}
              />
              <p className={styles.modalLoadingText}>Cargando detalle…</p>
            </div>
          ) : error ? (
            <p className={styles.inlineError}>{error}</p>
          ) : detail ? (
            <>
              {actionError ? <p className={styles.inlineError}>{actionError}</p> : null}

              <div className={styles.detailGrid}>
                <DetailItem label="Estado del archivo">
                  <UploadedFileStatusBadge status={detail.status} />
                </DetailItem>
                <DetailItem label="Tipo de destino">
                  {formatDestinationTypeLabel(detail.destinationType)}
                </DetailItem>
                <DetailItem label="Fecha de carga">
                  {formatAdminDateTime(detail.uploadedAt)}
                </DetailItem>
                <DetailItem label="Usuario">{detail.uploadedBy.name}</DetailItem>
                <DetailItem label="Correo">{detail.uploadedBy.email}</DetailItem>
                <DetailItem label="Importaciones">{String(detail.jobCount)}</DetailItem>
                <DetailItem label="Última actualización">
                  {formatAdminDateTime(detail.updatedAt)}
                </DetailItem>
                <DetailItem label="Ruta en almacenamiento" wide>
                  <span className={styles.detailValueMuted}>{detail.storagePath}</span>
                </DetailItem>
              </div>

              <section className={styles.sectionBlock} aria-label="Última importación">
                <h3 className={styles.sectionBlockTitle}>Última importación</h3>
                {detail.latestJob ? (
                  <div className={styles.detailGrid}>
                    <DetailItem label="Estado">
                      <ImportJobStatusBadge status={detail.latestJob.status} />
                    </DetailItem>
                    <DetailItem label="Finalizada">
                      {detail.latestJob.finishedAt
                        ? formatAdminDateTime(detail.latestJob.finishedAt)
                        : "—"}
                    </DetailItem>
                    <DetailItem label="Catálogo">
                      {latestDestination?.primary ?? "—"}
                    </DetailItem>
                    <DetailItem label="Carpeta">
                      {detail.latestJob.folder?.name ?? "—"}
                    </DetailItem>
                    <DetailItem label="Hojas detectadas">
                      {String(detail.latestJob.sheetsDetected)}
                    </DetailItem>
                    <DetailItem label="Hoja importada">
                      {detail.latestJob.sheetImported ?? "—"}
                    </DetailItem>
                    <DetailItem label="Acción">
                      {detail.latestJob.actionType
                        ? IMPORT_ACTION_TYPE_LABELS[detail.latestJob.actionType]
                        : "—"}
                    </DetailItem>
                    <DetailItem label="Resultado">
                      {formatImportMetrics(detail.latestJob)}
                    </DetailItem>
                  </div>
                ) : (
                  <p className={styles.detailValue}>
                    No hay importaciones finalizadas. Podés reprocesar el archivo para iniciar
                    una nueva importación.
                  </p>
                )}
              </section>

              <section className={styles.sectionBlock} aria-label="Historial de importaciones">
                <h3 className={styles.sectionBlockTitle}>Historial de importaciones</h3>
                {detail.jobs.length === 0 ? (
                  <p className={styles.detailValue}>Sin importaciones registradas.</p>
                ) : (
                  <ul className={styles.jobHistoryList}>
                    {detail.jobs.map((job) => (
                      <li key={job.id} className={styles.jobHistoryItem}>
                        <div className={styles.jobHistoryHeader}>
                          <ImportJobStatusBadge status={job.status} />
                          <span className={styles.jobHistoryMeta}>
                            {formatAdminDateTime(job.createdAt)}
                            {job.finishedAt
                              ? ` · Finalizada ${formatAdminDateTime(job.finishedAt)}`
                              : ""}
                          </span>
                        </div>
                        <p className={styles.jobHistoryMeta}>
                          {job.catalog?.name ?? "Sin catálogo"}
                          {job.folder ? ` · ${job.folder.name}` : ""}
                          {job.targetSheetName ? ` · Hoja ${job.targetSheetName}` : ""}
                          {job.sheetCount > 0 ? ` · ${job.sheetCount} hojas` : ""}
                        </p>
                        <div className={styles.jobHistoryActions}>
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() => onViewReport(job.id)}
                            disabled={isBusy}
                          >
                            <FileSpreadsheet strokeWidth={ICON_STROKE} aria-hidden />
                            Ver informe
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>

        {detail ? (
          <footer className={styles.modalFooter}>
            <button
              type="button"
              className={styles.modalButtonSecondary}
              onClick={onDownload}
              disabled={isBusy || isLoading}
            >
              <FileDown strokeWidth={ICON_STROKE} aria-hidden />
              Descargar original
            </button>
            <button
              type="button"
              className={styles.modalButton}
              onClick={onReprocess}
              disabled={isBusy || isLoading}
            >
              <RefreshCcw strokeWidth={ICON_STROKE} aria-hidden />
              Reprocesar
            </button>
            <button
              type="button"
              className={styles.modalButtonSecondary}
              onClick={() => onViewReport()}
              disabled={isBusy || isLoading}
            >
              <FileSpreadsheet strokeWidth={ICON_STROKE} aria-hidden />
              Ver informe
            </button>
            <button
              type="button"
              className={styles.modalButtonDanger}
              onClick={onDelete}
              disabled={isBusy || isLoading}
            >
              <Trash2 strokeWidth={ICON_STROKE} aria-hidden />
              Eliminar
            </button>
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function DetailItem({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`${styles.detailItem} ${wide ? styles.detailItemWide : ""}`}>
      <span className={styles.detailLabel}>{label}</span>
      <div className={styles.detailValue}>{children}</div>
    </div>
  );
}
