"use client";

import type { FolderColumn } from "@/generated/prisma/client";
import {
  CREATE_COLUMN_VALUE,
  IGNORE_COLUMN_VALUE,
  buildDefaultColumnMappingRows,
  detectColumnSemanticKind,
  semanticKindLabel,
  type ColumnMappingRow,
  type ImportDetectedHeader,
} from "@/features/imports/utils/column-mapping";
import styles from "./ImportWizard.module.scss";

type ImportStepColumnsProps = {
  headers: ImportDetectedHeader[];
  folderColumns: FolderColumn[];
  mappingRows: ColumnMappingRow[];
  primaryCodeHeaderKey: string;
  descriptionHeaderKey: string;
  disabled: boolean;
  onMappingRowsChange: (rows: ColumnMappingRow[]) => void;
  onPrimaryCodeHeaderKeyChange: (headerKey: string) => void;
  onDescriptionHeaderKeyChange: (headerKey: string) => void;
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
  descriptionHeaderKey,
  disabled,
  onMappingRowsChange,
  onPrimaryCodeHeaderKeyChange,
  onDescriptionHeaderKeyChange,
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
      <p className={styles.stepIntro}>
        Revisá cómo se mapean las columnas del Excel con la carpeta destino. Podés
        ajustar el código principal, la descripción y cada columna.
      </p>

      <div className={styles.field}>
        <div className={styles.fieldHeader}>
          <span className={styles.fieldLabel}>Columna código principal</span>
        </div>
        <select
          className={styles.mappingSelect}
          value={primaryCodeHeaderKey}
          onChange={(event) => onPrimaryCodeHeaderKeyChange(event.target.value)}
          disabled={disabled}
        >
          {headerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldHeader}>
          <span className={styles.fieldLabel}>Columna descripción</span>
        </div>
        <select
          className={styles.mappingSelect}
          value={descriptionHeaderKey}
          onChange={(event) => onDescriptionHeaderKeyChange(event.target.value)}
          disabled={disabled}
        >
          <option value="">Sin descripción</option>
          {headerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <table className={styles.columnMappingTable}>
        <thead>
          <tr>
            <th>Columna Excel</th>
            <th>Destino en carpeta</th>
          </tr>
        </thead>
        <tbody>
          {mappingRows.map((row) => {
            const semantic = semanticKindLabel(
              detectColumnSemanticKind(row.headerOriginalName),
            );

            return (
              <tr key={row.headerInternalKey}>
                <td>
                  {row.headerOriginalName}
                  {semantic ? (
                    <span className={styles.semanticBadge}>{semantic}</span>
                  ) : null}
                </td>
                <td>
                  <select
                    className={styles.mappingSelect}
                    value={row.targetValue}
                    onChange={(event) =>
                      updateRow(row.headerInternalKey, event.target.value)
                    }
                    disabled={disabled}
                  >
                    {targetOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
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
