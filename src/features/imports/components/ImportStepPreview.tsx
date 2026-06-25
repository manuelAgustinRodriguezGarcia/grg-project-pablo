"use client";

import type { ImportActionType } from "@/generated/prisma/client";
import type { ImportPreviewResponse } from "@/features/imports/types/import-job.types";
import { FileDown, ICON_STROKE, RefreshCcw } from "@/shared/icons";
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

async function copyPrimaryCode(code: string) {
  if (!code) {
    return;
  }

  try {
    await navigator.clipboard.writeText(code);
  } catch {
    // Clipboard may be unavailable outside a secure context.
  }
}

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

      <div className={styles.previewTableWrap}>
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Columna Nueva</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const primaryCode = row.primaryCode ?? "";

              return (
                <tr
                  key={`${row.rowNumber}-${primaryCode}`}
                  className={row.isMatch ? styles.matchRow : undefined}
                >
                  <td
                    className={styles.previewTableCodeCell}
                    title={primaryCode || undefined}
                    onClick={() => {
                      void copyPrimaryCode(primaryCode);
                    }}
                  >
                    {primaryCode || "—"}
                  </td>
                  <td className={styles.previewTableNewColumnCell}>
                    {row.isMatch ? "No" : "Sí"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={2}>No se detectaron productos en la hoja.</td>
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
