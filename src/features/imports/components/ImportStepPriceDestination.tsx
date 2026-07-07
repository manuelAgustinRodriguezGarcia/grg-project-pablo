"use client";

import { useMemo, useState } from "react";
import { CustomDropdown } from "@/features/catalog/components/CustomDropdown";
import { CustomDatePicker } from "@/shared/components/CustomDatePicker";
import type { ImportSheetItem } from "@/features/imports/types/import-job.types";
import type { PriceListListItem } from "@/features/prices/types/price-list.types";
import { Plus, FileSpreadsheet, ICON_STROKE } from "@/shared/icons";
import styles from "./ImportWizard.module.scss";

type ImportStepPriceDestinationProps = {
  fileName: string;
  priceLists: PriceListListItem[];
  importableSheets: ImportSheetItem[];
  excludedSheetCount: number;
  selectedPriceListId: string;
  selectedSheetName: string;
  supplierName: string;
  supplierDate: string;
  isBusy: boolean;
  onSupplierNameChange: (value: string) => void;
  onSupplierDateChange: (value: string) => void;
  onSelectPriceList: (priceListId: string) => void;
  onSelectSheet: (sheetName: string) => void;
  onCreatePriceList: (name: string) => Promise<boolean>;
};

export function ImportStepPriceDestination({
  fileName,
  priceLists,
  importableSheets,
  excludedSheetCount,
  selectedPriceListId,
  selectedSheetName,
  supplierName,
  supplierDate,
  isBusy,
  onSupplierNameChange,
  onSupplierDateChange,
  onSelectPriceList,
  onSelectSheet,
  onCreatePriceList,
}: ImportStepPriceDestinationProps) {
  const [listDraft, setListDraft] = useState<string | null>(null);

  const priceListOptions = useMemo(
    () =>
      priceLists.map((list) => ({
        id: list.id,
        label: list.name,
        meta:
          list.itemCount === 1
            ? "1 ítem"
            : `${list.itemCount.toLocaleString("es-AR")} ítems`,
      })),
    [priceLists],
  );

  const sheetOptions = useMemo(
    () =>
      importableSheets.map((sheet) => ({
        id: sheet.sheetName,
        label: sheet.sheetName,
        meta: sheet.rowCount === 1 ? "1 fila" : `${sheet.rowCount} filas`,
      })),
    [importableSheets],
  );

  async function submitPriceList() {
    const name = (listDraft ?? "").trim();
    if (!name) {
      return;
    }
    const ok = await onCreatePriceList(name);
    if (ok) {
      setListDraft(null);
    }
  }

  return (
    <div>
      <div className={styles.importSourceField}>
        <div className={styles.fieldHeader}>
          <span className={styles.fieldLabel}>Importando de:</span>
        </div>
        <div className={styles.importSource}>
          <span className={styles.importSourceIcon}>
            <FileSpreadsheet strokeWidth={ICON_STROKE} aria-hidden />
          </span>
          <span className={styles.importSourceFileName}>{fileName}</span>
        </div>
      </div>

      <div className={styles.supplierRow}>
        <div className={`${styles.field} ${styles.supplierNameField}`}>
          <div className={styles.fieldHeader}>
            <span className={styles.fieldLabel}>Nombre de proveedor</span>
          </div>
          <input
            className={styles.inlineInput}
            value={supplierName}
            onChange={(event) => onSupplierNameChange(event.target.value)}
            placeholder="Ingrese el nombre del proveedor"
            maxLength={200}
            disabled={isBusy}
            aria-label="Nombre de proveedor"
          />
        </div>

        <div className={`${styles.field} ${styles.supplierDateField}`}>
          <div className={styles.fieldHeader}>
            <span className={styles.fieldLabel}>Fecha</span>
          </div>
          <CustomDatePicker
            value={supplierDate}
            onChange={onSupplierDateChange}
            disabled={isBusy}
            ariaLabel="Fecha del proveedor"
            triggerClassName={styles.supplierDateControl}
          />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldHeader}>
          <span className={styles.fieldLabel}>Lista de precios</span>
          <button
            type="button"
            className={styles.addButton}
            onClick={() =>
              setListDraft((value) => (value === null ? selectedSheetName : null))
            }
            disabled={isBusy}
          >
            <Plus strokeWidth={ICON_STROKE} aria-hidden />
            Agregar
          </button>
        </div>

        <CustomDropdown
          label=""
          options={priceListOptions}
          selectedId={selectedPriceListId}
          onSelect={onSelectPriceList}
          disabled={isBusy || priceListOptions.length === 0}
          placeholder="Seleccione la lista de precios"
          emptyMessage="Sin listas de precios disponibles"
        />

        {listDraft !== null ? (
          <div className={styles.inlineForm}>
            <input
              className={styles.inlineInput}
              value={listDraft}
              onChange={(event) => setListDraft(event.target.value)}
              placeholder="Nombre de la nueva lista"
              maxLength={200}
              autoFocus
              disabled={isBusy}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitPriceList();
                }
              }}
            />
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void submitPriceList()}
              disabled={isBusy || listDraft.trim().length === 0}
            >
              Crear
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.field}>
        <div className={styles.fieldHeader}>
          <span className={styles.fieldLabel}>Página del Excel a importar</span>
        </div>

        <CustomDropdown
          label=""
          options={sheetOptions}
          selectedId={selectedSheetName}
          onSelect={onSelectSheet}
          disabled={isBusy || sheetOptions.length === 0}
          placeholder="Seleccione la página"
          emptyMessage="No hay páginas importables"
        />

        {excludedSheetCount > 0 ? (
          <p className={styles.sheetNote}>
            Se omitieron {excludedSheetCount}{" "}
            {excludedSheetCount === 1 ? "página" : "páginas"} que no contienen una tabla
            válida.
          </p>
        ) : null}
      </div>
    </div>
  );
}
