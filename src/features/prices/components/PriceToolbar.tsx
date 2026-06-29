"use client";

import {
  Banknote,
  FileSpreadsheet,
  Plus,
  Trash2,
  ICON_STROKE,
} from "@/shared/icons";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceToolbarProps = {
  hasSelectedList: boolean;
  onImportExcel: () => void;
  onAddItem: () => void;
  onClearList: () => void;
  onEditList: () => void;
  onDeleteList: () => void;
  onAddColumn?: () => void;
};

export function PriceToolbar({
  hasSelectedList,
  onImportExcel,
  onAddItem,
  onClearList,
  onEditList,
  onDeleteList,
  onAddColumn,
}: PriceToolbarProps) {
  return (
    <div className={styles.toolbar} aria-label="Acciones de precios">
      <button
        type="button"
        className={`${styles.toolbarButton} ${styles.toolbarButtonGreen}`}
        onClick={onImportExcel}
        disabled={!hasSelectedList}
        aria-label="Importar Excel"
      >
        <FileSpreadsheet strokeWidth={ICON_STROKE} aria-hidden />
        Importar Excel
      </button>

      <button
        type="button"
        className={`${styles.toolbarButton} ${styles.toolbarButtonPrimary}`}
        onClick={onAddItem}
        disabled={!hasSelectedList}
      >
        <Plus strokeWidth={ICON_STROKE} aria-hidden />
        Agregar ítem
      </button>

      {onAddColumn ? (
        <button
          type="button"
          className={styles.toolbarButton}
          onClick={onAddColumn}
          disabled={!hasSelectedList}
        >
          <Plus strokeWidth={ICON_STROKE} aria-hidden />
          Agregar columna
        </button>
      ) : null}

      <button
        type="button"
        className={`${styles.toolbarButton} ${styles.toolbarButtonDanger}`}
        onClick={onClearList}
        disabled={!hasSelectedList}
      >
        <Trash2 strokeWidth={ICON_STROKE} aria-hidden />
        Vaciar lista
      </button>

      <button
        type="button"
        className={styles.toolbarButton}
        onClick={onEditList}
        disabled={!hasSelectedList}
      >
        <Banknote strokeWidth={ICON_STROKE} aria-hidden />
        Editar lista
      </button>

      <button
        type="button"
        className={`${styles.toolbarButton} ${styles.toolbarButtonDanger}`}
        onClick={onDeleteList}
        disabled={!hasSelectedList}
      >
        Eliminar lista
      </button>
    </div>
  );
}
