"use client";

import { Trash2, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceToolbarProps = {
  hasSelectedList: boolean;
  onClearList: () => void;
};

export function PriceToolbar({
  hasSelectedList,
  onClearList,
}: PriceToolbarProps) {
  return (
    <div className={styles.toolbar} aria-label="Acciones de administración de precios">
      <button
        type="button"
        className={`${styles.toolbarButton} ${styles.toolbarButtonDangerHover}`}
        onClick={onClearList}
        disabled={!hasSelectedList}
      >
        <Trash2 strokeWidth={ICON_STROKE} aria-hidden />
        Vaciar lista
      </button>
    </div>
  );
}
