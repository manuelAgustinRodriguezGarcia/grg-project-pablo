"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ImportReportData } from "@/features/imports/types/import-wizard.types";
import { ImportJobStatusBadge } from "@/features/files/components/ImportJobStatusBadge";
import { IMPORT_ACTION_TYPE_LABELS } from "@/features/files/data/status-labels";
import type { UploadedFileReportResponse } from "@/features/files/types/uploaded-file.types";
import { formatAdminDateTime } from "@/features/files/utils/format-admin-datetime";
import { AlertTriangle, ICON_STROKE, RefreshCcw, X } from "@/shared/icons";
import styles from "@/features/files/styles/FilesManager.module.scss";

type UploadedFileReportModalProps = {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  report: UploadedFileReportResponse | null;
  onClose: () => void;
};

function isImportReportData(value: unknown): value is ImportReportData {
  return typeof value === "object" && value !== null;
}

export function UploadedFileReportModal({
  isOpen,
  isLoading,
  error,
  report,
  onClose,
}: UploadedFileReportModalProps) {
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
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const reportData = isImportReportData(report?.report) ? report.report : null;

  return createPortal(
    <div
      className={styles.modalOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
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
              Informe de importación
            </h2>
            {report ? (
              <p className={styles.modalSubtitle}>
                Job {report.jobId.slice(0, 8)} ·{" "}
                {report.finishedAt ? formatAdminDateTime(report.finishedAt) : "Sin fecha"}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
            aria-label="Cerrar informe"
            disabled={isLoading}
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
              <p className={styles.modalLoadingText}>Cargando informe…</p>
            </div>
          ) : error ? (
            <p className={styles.inlineError}>{error}</p>
          ) : !report ? (
            <p className={styles.detailValue}>No hay informe disponible.</p>
          ) : (
            <>
              <div className={styles.reportSection}>
                <h3 className={styles.reportSectionTitle}>Resumen</h3>
                <div className={styles.reportGrid}>
                  <ReportMetric label="Estado">
                    <ImportJobStatusBadge status={report.status} />
                  </ReportMetric>
                  <ReportMetric
                    label="Archivo"
                    value={reportData?.fileName ?? "—"}
                  />
                  <ReportMetric
                    label="Catálogo"
                    value={reportData?.catalogName ?? "—"}
                  />
                  <ReportMetric
                    label="Carpeta"
                    value={reportData?.folderName ?? "—"}
                  />
                  <ReportMetric
                    label="Hoja importada"
                    value={reportData?.sheetImported ?? "—"}
                  />
                  <ReportMetric
                    label="Acción"
                    value={
                      reportData?.actionApplied
                        ? IMPORT_ACTION_TYPE_LABELS[reportData.actionApplied]
                        : "—"
                    }
                  />
                </div>
              </div>

              {reportData ? (
                <>
                  <div className={styles.reportSection}>
                    <h3 className={styles.reportSectionTitle}>Productos</h3>
                    <div className={styles.reportGrid}>
                      <ReportMetric
                        label="Hojas detectadas"
                        value={String(reportData.sheetsDetected)}
                      />
                      <ReportMetric
                        label="Procesados"
                        value={String(reportData.productsProcessed)}
                      />
                      <ReportMetric
                        label="Creados"
                        value={String(reportData.productsCreated)}
                      />
                      <ReportMetric
                        label="Omitidos"
                        value={String(reportData.productsSkipped)}
                      />
                      <ReportMetric
                        label="Coincidencias"
                        value={String(reportData.productsMatched)}
                      />
                      <ReportMetric
                        label="Columnas detectadas"
                        value={String(reportData.columnsDetected)}
                      />
                    </div>
                  </div>

                  <div className={styles.reportSection}>
                    <h3 className={styles.reportSectionTitle}>Imágenes y fórmulas</h3>
                    <div className={styles.reportGrid}>
                      <ReportMetric
                        label="Imágenes detectadas"
                        value={String(reportData.imagesDetected)}
                      />
                      <ReportMetric
                        label="Asociadas"
                        value={String(reportData.imagesAssociated)}
                      />
                      <ReportMetric
                        label="Pendientes de revisión"
                        value={String(reportData.imagesPendingReview)}
                      />
                      <ReportMetric
                        label="Embebidas detectadas"
                        value={String(reportData.embeddedImagesDetected)}
                      />
                      <ReportMetric
                        label="Fórmulas detectadas"
                        value={String(reportData.formulasDetected)}
                      />
                      <ReportMetric
                        label="Fórmulas sin valor"
                        value={String(reportData.formulasWithoutCachedValue)}
                      />
                    </div>
                  </div>

                  {reportData.errors.length > 0 ? (
                    <div className={styles.reportSection}>
                      <h3 className={styles.reportSectionTitle}>Errores</h3>
                      <ul className={styles.messageList}>
                        {reportData.errors.map((message) => (
                          <li
                            key={message}
                            className={`${styles.messageListItem} ${styles.messageListItemError}`}
                          >
                            {message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {reportData.warnings.length > 0 ? (
                    <div className={styles.reportSection}>
                      <h3 className={styles.reportSectionTitle}>Advertencias</h3>
                      <ul className={styles.messageList}>
                        {reportData.warnings.map((message) => (
                          <li
                            key={message}
                            className={`${styles.messageListItem} ${styles.messageListItemWarning}`}
                          >
                            {message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : report.errorMessage ? (
                <div className={styles.modalLoading}>
                  <AlertTriangle strokeWidth={ICON_STROKE} aria-hidden />
                  <p className={styles.detailValue}>{report.errorMessage}</p>
                </div>
              ) : (
                <p className={styles.detailValue}>El informe no contiene datos estructurados.</p>
              )}
            </>
          )}
        </div>

        <footer className={styles.modalFooter}>
          <button
            type="button"
            className={styles.modalButtonSecondary}
            onClick={onClose}
            disabled={isLoading}
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function ReportMetric({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.reportMetric}>
      <span className={styles.reportMetricLabel}>{label}</span>
      {children ? (
        <div className={styles.reportMetricValue}>{children}</div>
      ) : (
        <span className={styles.reportMetricValue}>{value ?? "—"}</span>
      )}
    </div>
  );
}
