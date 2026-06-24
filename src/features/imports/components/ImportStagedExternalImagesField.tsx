"use client";

import { Camera, CheckCircle2, ICON_STROKE } from "@/shared/icons";
import {
  type StagedExternalImagesSummary,
} from "@/features/imports/utils/external-images";
import styles from "./ImportWizard.module.scss";

type ImportStagedExternalImagesFieldProps = {
  summary: StagedExternalImagesSummary;
};

function formatImageCount(count: number): string {
  if (count === 1) {
    return "1 imagen importada correctamente";
  }

  return `${count} imágenes importadas correctamente`;
}

export function ImportStagedExternalImagesField({
  summary,
}: ImportStagedExternalImagesFieldProps) {
  return (
    <div className={styles.importSourceField}>
      <div className={styles.fieldHeader}>
        <span className={styles.fieldLabel}>Imágenes adjuntas:</span>
      </div>

      {summary.sources.map((source) => (
        <div key={`${source.kind}-${source.name}`} className={styles.importSource}>
          <span className={`${styles.importSourceIcon} ${styles.importSourceIconImages}`}>
            <Camera strokeWidth={ICON_STROKE} aria-hidden />
          </span>
          <span className={styles.importSourceMeta}>
            <span className={styles.importSourceFileName}>{source.name}</span>
          </span>
        </div>
      ))}

      {summary.imageCount > 0 ? (
        <p className={styles.importSourceSuccess}>
          <CheckCircle2 strokeWidth={ICON_STROKE} aria-hidden />
          {formatImageCount(summary.imageCount)}
        </p>
      ) : null}
    </div>
  );
}
