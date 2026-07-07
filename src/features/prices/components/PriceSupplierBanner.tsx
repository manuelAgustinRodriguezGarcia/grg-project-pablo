"use client";

import { Pencil, ICON_STROKE } from "@/shared/icons";
import { formatIsoDateOnlyForDisplay } from "@/shared/utils/date-only";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceSupplierBannerProps = {
  supplierName: string | null;
  supplierDate: string | null;
  isAdmin: boolean;
  onEdit?: () => void;
};

export function PriceSupplierBanner({
  supplierName,
  supplierDate,
  isAdmin,
  onEdit,
}: PriceSupplierBannerProps) {
  if (!supplierName && !supplierDate) {
    return null;
  }

  const nameLabel = supplierName?.trim() || "Sin nombre";
  const dateLabel = supplierDate
    ? formatIsoDateOnlyForDisplay(supplierDate)
    : "Sin fecha";

  return (
    <div
      className={`${styles.supplierBanner} ${isAdmin ? styles.supplierBannerEditable : ""}`}
    >
      <p className={styles.supplierBannerText}>
        <span className={styles.supplierBannerLabel}>Proveedor:</span>{" "}
        <span className={styles.supplierBannerValue}>{nameLabel}</span>
        <span className={styles.supplierBannerDivider} aria-hidden>
          |
        </span>
        <span className={styles.supplierBannerLabel}>Fecha:</span>{" "}
        <span className={styles.supplierBannerValue}>{dateLabel}</span>
      </p>

      {isAdmin && onEdit ? (
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
