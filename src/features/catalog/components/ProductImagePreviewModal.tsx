"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ProductImagePreviewModalProps = {
  imageUrl: string;
  imageAlt: string;
  onClose: () => void;
};

export function ProductImagePreviewModal({
  imageUrl,
  imageAlt,
  onClose,
}: ProductImagePreviewModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={styles.imagePreviewOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={styles.imagePreviewCard}
        role="dialog"
        aria-modal="true"
        aria-label={imageAlt || "Vista previa de imagen"}
      >
        <button
          type="button"
          className={styles.imagePreviewClose}
          onClick={onClose}
          aria-label="Cerrar vista previa"
        >
          <X strokeWidth={ICON_STROKE} aria-hidden />
        </button>
        <img
          src={imageUrl}
          alt={imageAlt}
          className={styles.imagePreviewImage}
          decoding="async"
        />
      </div>
    </div>,
    document.body,
  );
}
