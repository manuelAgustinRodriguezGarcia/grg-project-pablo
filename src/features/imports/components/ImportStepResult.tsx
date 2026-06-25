"use client";

import type { ImportReportData } from "@/features/imports/types/import-wizard.types";
import { AlertTriangle, CheckCircle2, ICON_STROKE } from "@/shared/icons";
import styles from "./ImportWizard.module.scss";

type ImportStepResultProps = {
  report: ImportReportData | null;
  errorMessage: string | null;
};

export function ImportStepResult({ report, errorMessage }: ImportStepResultProps) {
  if (!report) {
    return (
      <div className={styles.result}>
        <span className={`${styles.resultIcon} ${styles.resultIconError}`}>
          <AlertTriangle strokeWidth={ICON_STROKE} aria-hidden />
        </span>
        <h3 className={styles.resultTitle}>No se pudo completar la importación</h3>
        <p className={styles.resultText}>
          {errorMessage ?? "Ocurrió un error inesperado durante la importación."}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.result}>
      <span className={styles.resultIcon}>
        <CheckCircle2 strokeWidth={ICON_STROKE} aria-hidden />
      </span>
      <h3 className={styles.resultTitle}>¡Importación completada!</h3>
      <p className={styles.resultText}>
        Los productos se guardaron en{" "}
        {report.folderName ?? "la carpeta"} dentro del catálogo{" "}
        {report.catalogName ?? "el catálogo"}.
      </p>
      {report.embeddedImagesDetected > 0 ? (
        <p className={styles.resultText}>
          Imágenes embebidas detectadas: {report.embeddedImagesDetected}. Asociadas
          automáticamente: {report.embeddedImagesAssociated ?? report.imagesAssociated}.
          {report.embeddedImagesPendingReview > 0
            ? ` Pendientes de revisión: ${report.embeddedImagesPendingReview}.`
            : ""}
          {report.embeddedImagesRejected > 0
            ? ` Rechazadas por formato: ${report.embeddedImagesRejected}.`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
