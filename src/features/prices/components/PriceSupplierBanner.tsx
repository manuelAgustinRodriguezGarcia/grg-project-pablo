"use client";

import {
  CalendarDays,
  ICON_STROKE,
  Pencil,
  SquareUser,
} from "@/shared/icons";
import { formatIsoDateOnlyForDisplay } from "@/shared/utils/date-only";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceSupplierBannerProps = {
  supplierName: string | null;
  supplierDate: string | null;
  isAdmin: boolean;
  onEdit?: () => void;
  placeholder?: boolean;
};

export function PriceSupplierBanner({
  supplierName,
  supplierDate,
  isAdmin,
  onEdit,
  placeholder = false,
}: PriceSupplierBannerProps) {
  if (placeholder) {
    return (
      <div className={styles.supplierBanner}>
        <p className={`${styles.supplierBannerText} ${styles.supplierBannerPlaceholder}`}>
          Aquí verá el nombre del proveedor y la fecha de la lista.
        </p>
      </div>
    );
  }

  if (!supplierName && !supplierDate) {
    return null;
  }

  const nameLabel = supplierName?.trim() || "Sin nombre";
  const dateLabel = supplierDate
    ? formatIsoDateOnlyForDisplay(supplierDate)
    : "Sin fecha";

  if (isAdmin) {
    return (
      <div className={`${styles.supplierBanner} ${styles.supplierBannerEditable}`}>
        <p className={styles.supplierBannerText}>
          <span className={styles.supplierBannerInlineLabel}>Proveedor:</span>{" "}
          <span className={styles.supplierBannerInlineValue}>{nameLabel}</span>
          <span className={styles.supplierBannerDivider} aria-hidden>
            |
          </span>
          <span className={styles.supplierBannerInlineLabel}>Fecha:</span>{" "}
          <span className={styles.supplierBannerInlineValue}>{dateLabel}</span>
        </p>

        {onEdit ? (
          <button
            type="button"
            className={styles.supplierBannerEditButton}
            onClick={onEdit}
            aria-label="Editar proveedor"
          >
            <Pencil strokeWidth={ICON_STROKE} aria-hidden />
            Editar
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${styles.supplierBanner} ${styles.supplierBannerUser}`}>
      <div className={styles.supplierBannerFields}>
        <div className={styles.supplierBannerField}>
          <SquareUser
            className={styles.supplierBannerIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <div className={styles.supplierBannerFieldText}>
            <span className={styles.supplierBannerLabel}>Proveedor</span>
            <span className={styles.supplierBannerValue}>{nameLabel}</span>
          </div>
        </div>
        <div className={styles.supplierBannerField}>
          <CalendarDays
            className={styles.supplierBannerIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <div className={styles.supplierBannerFieldText}>
            <span className={styles.supplierBannerLabel}>Fecha</span>
            <span className={styles.supplierBannerValue}>{dateLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
