"use client";

import type { ImportActionType } from "@/generated/prisma/client";
import type { ImportPreviewResponse } from "@/features/imports/types/import-job.types";
import styles from "./ImportWizard.module.scss";

const PREVIEW_ROW_LIMIT = 50;

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
  const { summary, products, warnings } = preview;
  const rows = products.slice(0, PREVIEW_ROW_LIMIT);

  return (
    <div>
      <div className={styles.destinationInfo}>
        <span>
          <span className={styles.destinationInfoLabel}>Catálogo: </span>
          {catalogName}
        </span>
        <span>
          <span className={styles.destinationInfoLabel}>Carpeta: </span>
          {folderName}
        </span>
        <span>
          <span className={styles.destinationInfoLabel}>Hoja: </span>
          {sheetName}
        </span>
      </div>

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
          <div className={styles.summaryValue}>{summary.imageCount}</div>
          <div className={styles.summaryLabel}>Imágenes</div>
        </div>
      </div>

      <div className={styles.previewTableWrap}>
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.rowNumber}-${row.primaryCode ?? ""}`}
                className={row.isMatch ? styles.matchRow : undefined}
              >
                <td>{row.primaryCode ?? "—"}</td>
                <td>{row.description ?? "—"}</td>
                <td>
                  {row.isMatch ? (
                    <span className={styles.matchBadge}>Ya existe</span>
                  ) : (
                    "Nuevo"
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3}>No se detectaron productos en la hoja.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {summary.totalProducts > rows.length ? (
        <p className={styles.sheetNote}>
          Mostrando los primeros {rows.length} de {summary.totalProducts}{" "}
          productos.
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <div className={styles.warnings}>
          Se detectaron {warnings.length}{" "}
          {warnings.length === 1 ? "advertencia" : "advertencias"} durante el
          análisis (por ejemplo, fórmulas o celdas con formato inesperado).
        </div>
      ) : null}

      <p className={styles.sectionLabel}>¿Qué querés hacer?</p>

      {summary.folderIsEmpty ? (
        <div className={styles.actionChoices}>
          <button
            type="button"
            className={`${styles.actionChoice} ${selectedAction === "IMPORTAR_LISTA" ? styles.actionChoiceActive : ""}`}
            onClick={() => onSelectAction("IMPORTAR_LISTA")}
          >
            <span className={styles.actionChoiceTitle}>Importar lista</span>
            <span className={styles.actionChoiceText}>
              La carpeta está vacía. Se agregarán los {summary.totalProducts}{" "}
              productos detectados.
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
            <span className={styles.actionChoiceTitle}>Combinar</span>
            <span className={styles.actionChoiceText}>
              Mantiene los {summary.folderProductCount} productos actuales y
              agrega solo los nuevos.
            </span>
          </button>
          <button
            type="button"
            className={`${styles.actionChoice} ${selectedAction === "REEMPLAZAR_LISTA" ? styles.actionChoiceActive : ""}`}
            onClick={() => onSelectAction("REEMPLAZAR_LISTA")}
          >
            <span className={styles.actionChoiceTitle}>Reemplazar</span>
            <span className={styles.actionChoiceText}>
              Borra los {summary.folderProductCount} productos actuales y los
              sustituye por la nueva lista.
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
