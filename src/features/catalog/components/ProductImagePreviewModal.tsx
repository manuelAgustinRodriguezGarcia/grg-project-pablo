"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Image, X, ICON_STROKE } from "@/shared/icons";
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
  const imageRef = useRef<HTMLImageElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setIsLoading(true);

    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setIsLoading(false);
    }
  }, [imageUrl]);

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
        aria-busy={isLoading}
      >
        <button
          type="button"
          className={styles.imagePreviewClose}
          onClick={onClose}
          aria-label="Cerrar vista previa"
        >
          <X strokeWidth={ICON_STROKE} aria-hidden />
        </button>

        <div className={styles.imagePreviewFrame}>
          {isLoading ? (
            <div className={styles.imagePreviewLoading} aria-live="polite">
              <Image
                className={styles.imagePreviewLoadingIcon}
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
              <span className={styles.imagePreviewLoadingText}>
                Cargando imagen...
              </span>
            </div>
          ) : null}

          <img
            ref={imageRef}
            src={imageUrl}
            alt={imageAlt}
            className={
              isLoading
                ? styles.imagePreviewImageLoading
                : styles.imagePreviewImage
            }
            decoding="async"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
