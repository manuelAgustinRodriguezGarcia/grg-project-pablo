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
import { Info, ICON_STROKE } from "@/shared/icons";
import { ImportSearchableSelect } from "./ImportSearchableSelect";
import styles from "./ImportWizard.module.scss";

const PRIMARY_CODE_HELP_TEXT =
  "Seleccione la columna del Excel que identificará de forma única a cada producto. Esto ayudará a facilitar la búsqueda de productos.";

type ImportStepColumnsProps = {
  headers: ImportDetectedHeader[];
  folderColumns: FolderColumn[];
  mappingRows: ColumnMappingRow[];
  primaryCodeHeaderKey: string;
  disabled: boolean;
  onMappingRowsChange: (rows: ColumnMappingRow[]) => void;
  onPrimaryCodeHeaderKeyChange: (headerKey: string) => void;
};

function buildTargetOptions(folderColumns: FolderColumn[]) {
  return [
    { value: CREATE_COLUMN_VALUE, label: "Crear columna nueva" },
    { value: IGNORE_COLUMN_VALUE, label: "Ignorar" },
    ...folderColumns.map((column) => ({
      value: column.internalKey,
      label: column.displayName,
    })),
  ];
}

export function ImportStepColumns({
  headers,
  folderColumns,
  mappingRows,
  primaryCodeHeaderKey,
  disabled,
  onMappingRowsChange,
  onPrimaryCodeHeaderKeyChange,
}: ImportStepColumnsProps) {
  const headerOptions = headers.map((header) => ({
    value: header.internalKey,
    label: header.originalName,
  }));
  const targetOptions = buildTargetOptions(folderColumns);

  function updateRow(headerInternalKey: string, targetValue: string) {
    onMappingRowsChange(
      mappingRows.map((row) =>
        row.headerInternalKey === headerInternalKey ? { ...row, targetValue } : row,
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
          <span className={styles.fieldLabelRow}>
            <span className={styles.fieldLabel}>Columna código principal</span>
            <span className={styles.fieldInfoWrap}>
              <button
                type="button"
                className={styles.fieldInfoButton}
                aria-label={PRIMARY_CODE_HELP_TEXT}
              >
                <Info strokeWidth={ICON_STROKE} aria-hidden />
              </button>
              <span className={styles.fieldInfoTooltip} role="tooltip">
                {PRIMARY_CODE_HELP_TEXT}
              </span>
            </span>
          </span>
        </div>
        <ImportSearchableSelect
          options={headerOptions}
          value={primaryCodeHeaderKey}
          onChange={onPrimaryCodeHeaderKeyChange}
          disabled={disabled}
          placeholder="Buscar columna del Excel…"
          listboxLabel="Columna código principal"
        />
      </div>

      <table className={styles.columnMappingTable}>
        <thead>
          <tr>
            <th>Columna Excel</th>
            <th>Destino en carpeta</th>
          </tr>
        </thead>
        <tbody>
          {mappingRows.map((row) => (
              <tr key={row.headerInternalKey}>
                <td>{row.headerOriginalName}</td>
                <td>
                  <ImportSearchableSelect
                    options={targetOptions}
                    value={row.targetValue}
                    onChange={(targetValue) =>
                      updateRow(row.headerInternalKey, targetValue)
                    }
                    disabled={disabled}
                    placeholder="Buscar destino…"
                    listboxLabel={`Destino para ${row.headerOriginalName}`}
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
