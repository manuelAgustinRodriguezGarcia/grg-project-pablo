"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Image, X, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ProductImagePreviewModalProps = {
  imageUrl: string;
  imageAlt: string;
  productId?: string;
  imageId?: string;
  onClose: () => void;
};

export function ProductImagePreviewModal({
  imageUrl,
  imageAlt,
  productId,
  imageId,
  onClose,
}: ProductImagePreviewModalProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedUrl, setResolvedUrl] = useState(imageUrl);

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
    let cancelled = false;

    async function resolvePreviewUrl() {
      setIsLoading(true);
      setResolvedUrl(imageUrl);

      if (productId && imageId) {
        try {
          const response = await fetch(
            `/api/admin/products/${productId}/images/${imageId}/url?size=full`,
          );

          if (response.ok) {
            const payload = (await response.json()) as { url: string | null };
            if (!cancelled && payload.url) {
              setResolvedUrl(payload.url);
            }
          }
        } catch {
          // Mantener thumbnail como fallback.
        }
      }

      if (!cancelled) {
        const image = imageRef.current;
        if (image?.complete && image.naturalWidth > 0) {
          setIsLoading(false);
        }
      }
    }

    void resolvePreviewUrl();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, productId, imageId]);

  useEffect(() => {
    setIsLoading(true);

    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setIsLoading(false);
    }
  }, [resolvedUrl]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={styles.imagePreviewOverlay}
      role="presentation"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <div
        className={styles.imagePreviewCard}
        role="dialog"
        aria-modal="true"
        aria-label={imageAlt || "Vista previa de imagen"}
        aria-busy={isLoading}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
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
            src={resolvedUrl}
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
