"use client";

import type { ImportActionType } from "@/generated/prisma/client";
import type { ImportPreviewResponse } from "@/features/imports/types/import-job.types";
import { FileDown, ICON_STROKE, RefreshCcw } from "@/shared/icons";
import styles from "./ImportWizard.module.scss";

type ImportStepPreviewProps = {
  preview: ImportPreviewResponse;
  catalogName: string;
  folderName: string;
  sheetName: string;
  selectedAction: ImportActionType | null;
  onSelectAction: (action: ImportActionType) => void;
};

export function ImportStepPreview({
  preview,
  catalogName,
  folderName,
  sheetName,
  selectedAction,
  onSelectAction,
}: ImportStepPreviewProps) {
  const { summary, warnings } = preview;
  const repeatedColumns = summary.repeatedColumns ?? [];

  return (
    <div>
      <p className={styles.destinationInfo}>
        Importando hoja{" "}
        <strong className={styles.destinationInfoBold}>{sheetName}</strong> en
        catálogo{" "}
        <strong className={styles.destinationInfoBold}>{catalogName}</strong>,
        carpeta:{" "}
        <strong className={styles.destinationInfoBold}>{folderName}</strong>
      </p>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{summary.totalProducts}</div>
          <div className={styles.summaryLabel}>Productos detectados</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryValue} ${styles.summaryValueMatch}`}>
            {summary.matchedCount}
          </div>
          <div className={styles.summaryLabel}>Ya existen en la carpeta</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{summary.columnCount}</div>
          <div className={styles.summaryLabel}>Columnas</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{summary.embeddedImagesDetected}</div>
          <div className={styles.summaryLabel}>Imágenes embebidas</div>
        </div>
        {summary.productsWithMultipleEmbeddedImages > 0 ? (
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>
              {summary.productsWithMultipleEmbeddedImages}
            </div>
            <div className={styles.summaryLabel}>Filas con varias imágenes</div>
          </div>
        ) : null}
      </div>

      {summary.embeddedImagesDetected > summary.totalProducts ? (
        <p className={styles.sheetNote}>
          Se detectaron {summary.embeddedImagesDetected} imágenes embebidas en{" "}
          {summary.rowsWithEmbeddedImages} filas del Excel ({summary.totalProducts}{" "}
          productos). Varias imágenes por fila se importarán como galería del producto.
        </p>
      ) : null}

      {repeatedColumns.length > 0 ? (
        <>
          <p className={styles.sectionLabel}>Columnas repetidas</p>
          <div className={styles.previewTableWrap}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>Columna repetida</th>
                </tr>
              </thead>
              <tbody>
                {repeatedColumns.map((columnName) => (
                  <tr key={columnName}>
                    <td>{columnName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {warnings.length > 0 ? (
        <div className={styles.warnings}>
          Se detectaron {warnings.length}{" "}
          {warnings.length === 1 ? "advertencia" : "advertencias"} durante el
          análisis (por ejemplo, fórmulas o celdas con formato inesperado).
        </div>
      ) : null}

      <p className={styles.sectionLabel}>¿Qué desea hacer?</p>

      {summary.folderIsEmpty ? (
        <div className={styles.actionChoices}>
          <button
            type="button"
            className={`${styles.actionChoice} ${selectedAction === "IMPORTAR_LISTA" ? styles.actionChoiceActive : ""}`}
            onClick={() => onSelectAction("IMPORTAR_LISTA")}
          >
            <span className={styles.actionChoiceIcon} aria-hidden>
              <FileDown strokeWidth={ICON_STROKE} />
            </span>
            <span className={styles.actionChoiceContent}>
              <span className={styles.actionChoiceTitle}>Importar lista</span>
              <span className={styles.actionChoiceText}>
                La carpeta está vacía. Se agregarán los {summary.totalProducts}{" "}
                productos detectados.
              </span>
            </span>
          </button>
        </div>
      ) : (
        <div className={styles.actionChoices}>
          <button
            type="button"
            className={`${styles.actionChoice} ${selectedAction === "COMBINAR_LISTA" ? styles.actionChoiceActive : ""}`}
            onClick={() => onSelectAction("COMBINAR_LISTA")}
          >
            <span className={styles.actionChoiceContent}>
              <span className={styles.actionChoiceTitle}>Combinar</span>
              <span className={styles.actionChoiceText}>
                Mantiene los {summary.folderProductCount} productos actuales y
                agrega solo los nuevos.
              </span>
            </span>
          </button>
          <button
            type="button"
            className={`${styles.actionChoice} ${selectedAction === "REEMPLAZAR_LISTA" ? styles.actionChoiceActive : ""}`}
            onClick={() => onSelectAction("REEMPLAZAR_LISTA")}
          >
            <span className={styles.actionChoiceIcon} aria-hidden>
              <RefreshCcw strokeWidth={ICON_STROKE} />
            </span>
            <span className={styles.actionChoiceContent}>
              <span className={styles.actionChoiceTitle}>Reemplazar</span>
              <span className={styles.actionChoiceText}>
                Borra los {summary.folderProductCount} productos actuales y los
                sustituye por la nueva lista.
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
