"use client";

import type { FolderColumn } from "@/generated/prisma/client";
import {
  CREATE_COLUMN_VALUE,
  IGNORE_COLUMN_VALUE,
  buildDefaultColumnMappingRows,
  detectColumnSemanticKind,
  type ColumnMappingRow,
  type ImportDetectedHeader,
} from "@/features/imports/utils/column-mapping";
import { ImportSearchableSelect } from "./ImportSearchableSelect";
import { ImportYesNoRadio } from "./ImportYesNoRadio";
import styles from "./ImportWizard.module.scss";

const PRIMARY_CODE_HELP_TEXT =
  "Seleccione la columna del Excel que identificará de forma única a cada producto. Esto ayudará a facilitar la búsqueda de productos.";

const GENERATED_PRIMARY_CODE_HELP_TEXT =
  "Se generará un ID corto automático por cada fila del Excel. Las imágenes se asociarán por otras columnas o por la fila, no por estos códigos generados. Al combinar listas, los productos importados se tratarán como nuevos.";

type ImportStepColumnsProps = {
  headers: ImportDetectedHeader[];
  folderColumns: FolderColumn[];
  mappingRows: ColumnMappingRow[];
  primaryCodeHeaderKey: string;
  useGeneratedPrimaryCodes: boolean;
  disabled: boolean;
  onMappingRowsChange: (rows: ColumnMappingRow[]) => void;
  onPrimaryCodeHeaderKeyChange: (headerKey: string) => void;
  onUseGeneratedPrimaryCodesChange: (value: boolean) => void;
};

function isCreateColumnTarget(targetValue: string): boolean {
  return targetValue !== IGNORE_COLUMN_VALUE;
}

export function ImportStepColumns({
  headers,
  folderColumns: _folderColumns,
  mappingRows,
  primaryCodeHeaderKey,
  useGeneratedPrimaryCodes,
  disabled,
  onMappingRowsChange,
  onPrimaryCodeHeaderKeyChange,
  onUseGeneratedPrimaryCodesChange,
}: ImportStepColumnsProps) {
  const headerOptions = headers.map((header) => ({
    value: header.internalKey,
    label: header.originalName,
  }));

  function updateRow(headerInternalKey: string, createColumn: boolean) {
    onMappingRowsChange(
      mappingRows.map((row) =>
        row.headerInternalKey === headerInternalKey
          ? {
              ...row,
              targetValue: createColumn ? CREATE_COLUMN_VALUE : IGNORE_COLUMN_VALUE,
            }
          : row,
      ),
    );
  }

  if (headers.length === 0) {
    return (
      <p className={styles.stepIntro}>
        No se detectaron columnas en la hoja seleccionada.
      </p>
    );
  }

  return (
    <div>
      <div className={`${styles.field} ${styles.primaryCodeField}`}>
        <div className={styles.fieldHeader}>
          <span className={styles.fieldLabel}>Columna código principal</span>
        </div>
        <p className={styles.fieldHelpText}>
          {useGeneratedPrimaryCodes
            ? GENERATED_PRIMARY_CODE_HELP_TEXT
            : PRIMARY_CODE_HELP_TEXT}
        </p>
        <div className={styles.primaryCodeSelectWrap}>
          <div className={styles.primaryCodeSelectRow}>
            <div className={styles.primaryCodeSelectControl}>
              <ImportSearchableSelect
                options={headerOptions}
                value={primaryCodeHeaderKey}
                onChange={onPrimaryCodeHeaderKeyChange}
                disabled={disabled || useGeneratedPrimaryCodes}
                placeholder="Buscar columna del Excel…"
                listboxLabel="Columna código principal"
              />
            </div>
            <button
              type="button"
              className={`${styles.secondaryButton} ${styles.generateCodesButton} ${useGeneratedPrimaryCodes ? styles.generateCodesButtonActive : ""}`}
              aria-pressed={useGeneratedPrimaryCodes}
              disabled={disabled}
              onClick={() =>
                onUseGeneratedPrimaryCodesChange(!useGeneratedPrimaryCodes)
              }
            >
              Generar Códigos
            </button>
          </div>
        </div>
      </div>

      <table className={styles.columnMappingTable}>
        <thead>
          <tr>
            <th>Columna Excel</th>
            <th>Crear columna nueva</th>
          </tr>
        </thead>
        <tbody>
          {mappingRows.map((row) => (
            <tr key={row.headerInternalKey}>
              <td>{row.headerOriginalName}</td>
              <td>
                <ImportYesNoRadio
                  name={`create-column-${row.headerInternalKey}`}
                  value={isCreateColumnTarget(row.targetValue)}
                  onChange={(createColumn) =>
                    updateRow(row.headerInternalKey, createColumn)
                  }
                  disabled={disabled}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function createInitialColumnMappingState(
  headers: ImportDetectedHeader[],
  folderColumns: FolderColumn[],
) {
  return {
    mappingRows: buildDefaultColumnMappingRows(headers, folderColumns),
    primaryCodeHeaderKey: headers.find(
      (header) => detectColumnSemanticKind(header.originalName) === "primaryCode",
    )?.internalKey ?? headers[0]?.internalKey ?? "",
    descriptionHeaderKey:
      headers.find(
        (header) => detectColumnSemanticKind(header.originalName) === "description",
      )?.internalKey ?? "",
  };
}
