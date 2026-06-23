"use client";

import { useCallback, useEffect, useState } from "react";
import {
  associateImportImageAction,
  completeImageReviewAction,
  deleteImportImageAction,
  listImportImageReviewAction,
} from "@/features/imports/actions/import.actions";
import type { ImportImageReviewItem } from "@/features/imports/types/import-job.types";
import type { ProductTableResponse } from "@/features/catalog/types/product-table.types";
import { ProductSearchCombobox } from "./ProductSearchCombobox";
import styles from "./ImportWizard.module.scss";

type ImportStepImageReviewProps = {
  jobId: string;
  folderId: string;
  disabled: boolean;
  onCompleted: () => void;
  onError: (message: string) => void;
};

type FolderProductOption = {
  id: string;
  label: string;
};

function formatProductLabel(
  product: ProductTableResponse["products"][number],
): string {
  const code = product.primaryCode?.trim();
  const description = product.description?.trim();

  if (code && description) {
    return `${code} — ${description}`;
  }

  return code ?? description ?? product.id;
}

export function ImportStepImageReview({
  jobId,
  folderId,
  disabled,
  onCompleted,
  onError,
}: ImportStepImageReviewProps) {
  const [items, setItems] = useState<ImportImageReviewItem[]>([]);
  const [products, setProducts] = useState<FolderProductOption[]>([]);
  const [selectedProductByImage, setSelectedProductByImage] = useState<
    Record<string, string>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReviewData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reviewResult, productsResponse] = await Promise.all([
        listImportImageReviewAction({
          jobId,
          page: 1,
          pageSize: 200,
          status: "PENDING_REVIEW",
        }),
        fetch(`/api/admin/folders/${folderId}/products?page=1&pageSize=200`),
      ]);

      if (!reviewResult.success) {
        throw new Error(reviewResult.error);
      }

      if (!productsResponse.ok) {
        throw new Error("No se pudieron cargar los productos de la carpeta.");
      }

      const productsData = (await productsResponse.json()) as ProductTableResponse;
      setItems(reviewResult.data.items);
      setProducts(
        productsData.products.map((product) => ({
          id: product.id,
          label: formatProductLabel(product),
        })),
      );
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cargar la revisión de imágenes.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [folderId, jobId, onError]);

  useEffect(() => {
    void loadReviewData();
  }, [loadReviewData]);

  async function handleAssociate(imageId: string) {
    const productId = selectedProductByImage[imageId];
    if (!productId) {
      onError("Seleccioná un producto para asociar la imagen.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await associateImportImageAction({ jobId, imageId, productId });
      if (!result.success) {
        throw new Error(result.error);
      }
      await loadReviewData();
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : "No se pudo asociar la imagen.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject(imageId: string) {
    setIsSubmitting(true);
    try {
      const result = await deleteImportImageAction({ jobId, imageId });
      if (!result.success) {
        throw new Error(result.error);
      }
      await loadReviewData();
    } catch (caught) {
      onError(
        caught instanceof Error ? caught.message : "No se pudo rechazar la imagen.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssociateAll() {
    const pendingAssociations = items
      .map((item) => ({
        imageId: item.id,
        productId: selectedProductByImage[item.id],
      }))
      .filter((entry): entry is { imageId: string; productId: string } =>
        Boolean(entry.productId),
      );

    if (pendingAssociations.length === 0) {
      onError("Seleccioná al menos un producto para asociar las imágenes.");
      return;
    }

    setIsSubmitting(true);
    try {
      for (const association of pendingAssociations) {
        const result = await associateImportImageAction({
          jobId,
          imageId: association.imageId,
          productId: association.productId,
        });
        if (!result.success) {
          throw new Error(result.error);
        }
      }
      await loadReviewData();
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron asociar todas las imágenes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRejectAll() {
    setIsSubmitting(true);
    try {
      for (const item of items) {
        const result = await deleteImportImageAction({ jobId, imageId: item.id });
        if (!result.success) {
          throw new Error(result.error);
        }
      }
      await loadReviewData();
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron rechazar todas las imágenes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCompleteReview() {
    setIsSubmitting(true);
    try {
      const result = await completeImageReviewAction({ jobId });
      if (!result.success) {
        throw new Error(result.error);
      }
      onCompleted();
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : "No se pudo finalizar la revisión de imágenes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className={styles.stepIntro}>Cargando imágenes pendientes…</p>;
  }

  if (items.length === 0) {
    return (
      <div>
        <p className={styles.stepIntro}>
          No quedan imágenes pendientes de revisión.
        </p>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void handleCompleteReview()}
          disabled={disabled || isSubmitting}
        >
          Continuar al resultado
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className={styles.stepIntro}>
        Algunas imágenes no se pudieron asociar automáticamente. Revisalas y
        vinculalas a un producto o rechazalas antes de finalizar.
      </p>

      <div className={styles.imageReviewToolbar}>
        <button
          type="button"
          className={styles.successButton}
          onClick={() => void handleAssociateAll()}
          disabled={disabled || isSubmitting}
        >
          Asociar todas
        </button>
        <button
          type="button"
          className={styles.dangerButton}
          onClick={() => void handleRejectAll()}
          disabled={disabled || isSubmitting}
        >
          Rechazar todas
        </button>
      </div>

      <div className={styles.imageReviewList}>
        {items.map((item) => (
          <article key={item.id} className={styles.imageReviewItem}>
            {item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt=""
                className={styles.imageReviewThumb}
              />
            ) : (
              <span className={styles.imageReviewThumb} aria-hidden />
            )}

            <div className={styles.imageReviewMeta}>
              <span className={styles.imageReviewName} title={item.originalName}>
                {item.originalName}
              </span>
              <span className={styles.imageReviewDetail}>
                Estado: {item.status}
              </span>
              {item.sourceRow ? (
                <span className={styles.imageReviewDetail}>
                  Fila origen: {item.sourceRow}
                  {item.sourceColumn ? ` · ${item.sourceColumn}` : ""}
                </span>
              ) : null}
            </div>

            <div className={styles.imageReviewActions}>
              <ProductSearchCombobox
                options={products}
                selectedId={selectedProductByImage[item.id] ?? ""}
                onSelect={(productId) =>
                  setSelectedProductByImage((current) => ({
                    ...current,
                    [item.id]: productId,
                  }))
                }
                disabled={disabled || isSubmitting}
                placeholder="Buscar producto…"
              />
              <button
                type="button"
                className={styles.successButton}
                onClick={() => void handleAssociate(item.id)}
                disabled={disabled || isSubmitting}
              >
                Asociar
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => void handleReject(item.id)}
                disabled={disabled || isSubmitting}
              >
                Rechazar
              </button>
            </div>
          </article>
        ))}
      </div>

      <button
        type="button"
        className={`${styles.primaryButton} ${styles.imageReviewFinishButton}`}
        onClick={() => void handleCompleteReview()}
        disabled={disabled || isSubmitting}
      >
        Finalizar revisión de imágenes
      </button>
    </div>
  );
}
