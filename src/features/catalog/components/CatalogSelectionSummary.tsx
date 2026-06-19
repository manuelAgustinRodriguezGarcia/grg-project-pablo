"use client";

import { Info, ICON_STROKE } from "@/shared/icons";
import type {
  MockCatalog,
  MockFolder,
} from "@/features/catalog/types/catalog-navigator.types";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type CatalogSelectionSummaryProps = {
  catalog: MockCatalog | null;
  folder: MockFolder | null;
};

export function CatalogSelectionSummary({
  catalog,
  folder,
}: CatalogSelectionSummaryProps) {
  if (!catalog || !folder) {
    return (
      <section
        className={`${styles.panel} ${styles.summaryPanel}`}
        aria-label="Resumen de selección"
      >
        <p className={styles.emptyState}>Seleccioná un catálogo y una carpeta.</p>
      </section>
    );
  }

  return (
    <section
      className={`${styles.panel} ${styles.summaryPanel}`}
      aria-label="Resumen de selección"
    >
      <div className={styles.panelHeader}>
        <Info className={styles.panelIcon} strokeWidth={ICON_STROKE} aria-hidden />
        <h2 className={styles.panelTitle}>Resumen</h2>
      </div>

      <p className={styles.breadcrumb}>
        <span>{catalog.name}</span>
        <span className={styles.breadcrumbSeparator} aria-hidden="true">
          &gt;
        </span>
        <span className={styles.breadcrumbCurrent}>{folder.name}</span>
      </p>

      <p className={styles.stats}>
        {folder.products.length} productos · {folder.columns.length} columnas
      </p>

      <div className={styles.placeholder}>
        <Info className={styles.placeholderIcon} strokeWidth={ICON_STROKE} aria-hidden />
        <p className={styles.placeholderTitle}>Tabla de productos — próximo paso</p>
        <p className={styles.placeholderText}>
          En la próxima fase se implementará la tabla dinámica con las columnas
          configuradas de esta carpeta.
        </p>
      </div>
    </section>
  );
}
