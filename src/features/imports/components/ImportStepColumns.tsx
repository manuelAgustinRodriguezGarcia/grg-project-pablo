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

const PRIMARY_CODE_FIELD_LABEL = "Código para vincular imágenes del ZIP";

const PRIMARY_CODE_HELP_TEXT =
  "Seleccione la columna del Excel que vinculará las imágenes del archivo ZIP con los productos del catálogo.";

type ImportStepColumnsProps = {
  headers: ImportDetectedHeader[];
  folderColumns: FolderColumn[];
  mappingRows: ColumnMappingRow[];
  primaryCodeHeaderKey: string;
  showPrimaryCodeSelection: boolean;
  disabled: boolean;
  onMappingRowsChange: (rows: ColumnMappingRow[]) => void;
  onPrimaryCodeHeaderKeyChange: (headerKey: string) => void;
};

function isCreateColumnTarget(targetValue: string): boolean {
  return targetValue !== IGNORE_COLUMN_VALUE;
}

export function ImportStepColumns({
  headers,
  folderColumns: _folderColumns,
  mappingRows,
  primaryCodeHeaderKey,
  showPrimaryCodeSelection,
  disabled,
  onMappingRowsChange,
  onPrimaryCodeHeaderKeyChange,
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

  function updateAllRows(createColumn: boolean) {
    onMappingRowsChange(
      mappingRows.map((row) => ({
        ...row,
        targetValue: createColumn ? CREATE_COLUMN_VALUE : IGNORE_COLUMN_VALUE,
      })),
    );
  }

  const allColumnsSelected =
    mappingRows.length > 0 &&
    mappingRows.every((row) => isCreateColumnTarget(row.targetValue));

  if (headers.length === 0) {
    return (
      <p className={styles.stepIntro}>
        No se detectaron columnas en la hoja seleccionada.
      </p>
    );
  }

  return (
    <div>
      {showPrimaryCodeSelection ? (
        <div className={`${styles.field} ${styles.primaryCodeField}`}>
          <div className={styles.fieldHeader}>
            <span className={styles.fieldLabel}>{PRIMARY_CODE_FIELD_LABEL}</span>
          </div>
          <p className={styles.fieldHelpText}>{PRIMARY_CODE_HELP_TEXT}</p>
          <div className={styles.primaryCodeSelectWrap}>
            <ImportSearchableSelect
              options={headerOptions}
              value={primaryCodeHeaderKey}
              onChange={onPrimaryCodeHeaderKeyChange}
              disabled={disabled}
              placeholder="Buscar columna del Excel…"
              listboxLabel={PRIMARY_CODE_FIELD_LABEL}
            />
          </div>
        </div>
      ) : null}

      <div className={styles.columnMappingSelectAllCard}>
        <span className={styles.columnMappingSelectAllLabel}>SELECCIONAR TODAS</span>
        <ImportYesNoRadio
          name="create-column-select-all"
          value={allColumnsSelected}
          onChange={updateAllRows}
          disabled={disabled}
        />
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
