"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  associateImportImageAction,
  completeImageReviewAction,
  deleteImportImageAction,
  listImportImageReviewAction,
} from "@/features/imports/actions/import.actions";
import type { ImportImageReviewItem } from "@/features/imports/types/import-job.types";
import { ProductImagePreviewModal } from "@/features/catalog/components/ProductImagePreviewModal";
import { ImportYesNoRadio } from "./ImportYesNoRadio";
import { ProductSearchCombobox } from "./ProductSearchCombobox";
import styles from "./ImportWizard.module.scss";

type ImportStepImageReviewProps = {
  jobId: string;
  folderId: string;
  disabled: boolean;
  onCompleted: () => void;
  onError: (message: string) => void;
  onFooterStateChange?: (state: ImageReviewFooterState | null) => void;
};

export type ImageReviewFooterState = {
  finishLabel: string;
  onFinish: () => void;
  disabled: boolean;
};

type FolderProductOption = {
  id: string;
  label: string;
};

const IMAGE_PAGE_SIZE = 50;

function formatProductOptionLabel(product: {
  id: string;
  primaryCode: string | null;
  description: string | null;
}): string {
  const code = product.primaryCode?.trim();
  const description = product.description?.trim();

  if (code && description) {
    return `${code} — ${description}`;
  }

  return code ?? description ?? product.id;
}

function shouldLinkImage(
  linkByImage: Record<string, boolean>,
  imageId: string,
): boolean {
  return linkByImage[imageId] ?? false;
}

function getPreviewImageUrl(item: ImportImageReviewItem): string | null {
  return item.fullUrl ?? item.thumbnailUrl;
}

export function ImportStepImageReview({
  jobId,
  folderId,
  disabled,
  onCompleted,
  onError,
  onFooterStateChange,
}: ImportStepImageReviewProps) {
  const [items, setItems] = useState<ImportImageReviewItem[]>([]);
  const [products, setProducts] = useState<FolderProductOption[]>([]);
  const [selectedProductByImage, setSelectedProductByImage] = useState<
    Record<string, string>
  >({});
  const [linkByImage, setLinkByImage] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePage, setImagePage] = useState(1);
  const [totalImages, setTotalImages] = useState(0);
  const [isLoadingMoreImages, setIsLoadingMoreImages] = useState(false);
  const onCompletedRef = useRef(onCompleted);
  const onErrorRef = useRef(onError);
  const handleCompleteReviewRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    onCompletedRef.current = onCompleted;
    onErrorRef.current = onError;
  }, [onCompleted, onError]);

  const loadReviewData = useCallback(async () => {
    setIsLoading(true);
    setImagePage(1);
    try {
      const [reviewResult, productsResponse] = await Promise.all([
        listImportImageReviewAction({
          jobId,
          page: 1,
          pageSize: IMAGE_PAGE_SIZE,
          status: "PENDING_REVIEW",
        }),
        fetch(`/api/admin/folders/${folderId}/products/options`),
      ]);

      if (!reviewResult.success) {
        throw new Error(reviewResult.error);
      }

      if (!productsResponse.ok) {
        throw new Error("No se pudieron cargar los productos de la carpeta.");
      }

      const productsData = (await productsResponse.json()) as {
        products: Array<{
          id: string;
          primaryCode: string | null;
          description: string | null;
        }>;
      };

      setItems(reviewResult.data.items);
      setTotalImages(reviewResult.data.pagination.total);
      setProducts(
        productsData.products.map((product) => ({
          id: product.id,
          label: formatProductOptionLabel(product),
        })),
      );
      setSelectedProductByImage({});
      setLinkByImage({});
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

  const loadMoreImages = useCallback(async () => {
    const nextPage = imagePage + 1;
    setIsLoadingMoreImages(true);

    try {
      const reviewResult = await listImportImageReviewAction({
        jobId,
        page: nextPage,
        pageSize: IMAGE_PAGE_SIZE,
        status: "PENDING_REVIEW",
      });

      if (!reviewResult.success) {
        throw new Error(reviewResult.error);
      }

      setItems((current) => [...current, ...reviewResult.data.items]);
      setImagePage(nextPage);
      setTotalImages(reviewResult.data.pagination.total);
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar más imágenes.",
      );
    } finally {
      setIsLoadingMoreImages(false);
    }
  }, [imagePage, jobId, onError]);

  const fetchAllPendingItems = useCallback(async () => {
    const allItems: ImportImageReviewItem[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const reviewResult = await listImportImageReviewAction({
        jobId,
        page,
        pageSize: IMAGE_PAGE_SIZE,
        status: "PENDING_REVIEW",
      });

      if (!reviewResult.success) {
        throw new Error(reviewResult.error);
      }

      allItems.push(...reviewResult.data.items);
      totalPages = reviewResult.data.pagination.totalPages;
      page += 1;
    }

    return allItems;
  }, [jobId]);

  useEffect(() => {
    void loadReviewData();
  }, [loadReviewData]);

  function handleProductSelect(imageId: string, productId: string) {
    setSelectedProductByImage((current) => ({
      ...current,
      [imageId]: productId,
    }));
    setLinkByImage((current) => ({
      ...current,
      [imageId]: Boolean(productId),
    }));
  }

  function handleLinkChoice(imageId: string, link: boolean) {
    setLinkByImage((current) => ({
      ...current,
      [imageId]: link,
    }));

    if (!link) {
      setSelectedProductByImage((current) => ({
        ...current,
        [imageId]: "",
      }));
    }
  }

  async function applyReviewDecisions(
    decisions: Array<{ imageId: string; link: boolean; productId?: string }>,
  ) {
    for (const decision of decisions) {
      if (decision.link) {
        if (!decision.productId) {
          throw new Error(
            "Seleccione un producto para vincular cada imagen marcada como Vincular.",
          );
        }

        const result = await associateImportImageAction({
          jobId,
          imageId: decision.imageId,
          productId: decision.productId,
        });
        if (!result.success) {
          throw new Error(result.error);
        }
        continue;
      }

      const result = await deleteImportImageAction({
        jobId,
        imageId: decision.imageId,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    }
  }

  async function handleIgnoreAll() {
    setIsSubmitting(true);
    try {
      const pendingItems = await fetchAllPendingItems();
      await applyReviewDecisions(
        pendingItems.map((item) => ({
          imageId: item.id,
          link: false,
        })),
      );
      const result = await completeImageReviewAction({ jobId });
      if (!result.success) {
        throw new Error(result.error);
      }
      onCompleted();
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron ignorar todas las imágenes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleCompleteReview = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const pendingItems = await fetchAllPendingItems();
      await applyReviewDecisions(
        pendingItems.map((item) => ({
          imageId: item.id,
          link: shouldLinkImage(linkByImage, item.id),
          productId: selectedProductByImage[item.id],
        })),
      );
      const result = await completeImageReviewAction({ jobId });
      if (!result.success) {
        throw new Error(result.error);
      }
      onCompletedRef.current();
    } catch (caught) {
      onErrorRef.current(
        caught instanceof Error
          ? caught.message
          : "No se pudo finalizar la revisión de imágenes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchAllPendingItems, jobId, linkByImage, selectedProductByImage]);

  handleCompleteReviewRef.current = handleCompleteReview;

  useEffect(() => {
    if (!onFooterStateChange) {
      return;
    }

    if (isLoading) {
      onFooterStateChange(null);
      return;
    }

    onFooterStateChange({
      finishLabel:
        items.length === 0 ? "Continuar al resultado" : "Finalizar Revisión",
      onFinish: () => {
        void handleCompleteReviewRef.current();
      },
      disabled: disabled || isSubmitting,
    });
  }, [disabled, isLoading, isSubmitting, items.length, onFooterStateChange]);

  useEffect(() => {
    return () => {
      onFooterStateChange?.(null);
    };
  }, [onFooterStateChange]);

  if (isLoading) {
    return <p className={styles.stepIntro}>Cargando imágenes pendientes…</p>;
  }

  if (items.length === 0) {
    return (
      <p className={styles.stepIntro}>
        No quedan imágenes pendientes de revisión.
      </p>
    );
  }

  return (
    <div className={styles.imageReviewStep}>
      <div className={styles.imageReviewIntroRow}>
        <p className={`${styles.stepIntro} ${styles.imageReviewIntroText}`}>
          Si desea vincular las imágenes con los productos en otro momento,
          presione el botón.
        </p>
        <button
          type="button"
          className={`${styles.primaryButton} ${styles.imageReviewIgnoreAllButton}`}
          onClick={() => void handleIgnoreAll()}
          disabled={disabled || isSubmitting}
        >
          Ignorar todas
        </button>
      </div>

      <div className={styles.imageReviewList}>
        {items.map((item) => {
          const selectedProductId = selectedProductByImage[item.id] ?? "";
          const linkImage = shouldLinkImage(linkByImage, item.id);

          return (
            <article key={item.id} className={styles.imageReviewItem}>
              <div className={styles.imageReviewTop}>
                {item.thumbnailUrl ? (
                  <button
                    type="button"
                    className={styles.imageReviewThumbButton}
                    onClick={() => {
                      const imageUrl = getPreviewImageUrl(item);
                      if (!imageUrl) {
                        return;
                      }

                      setPreviewImage({
                        url: imageUrl,
                        alt: item.originalName,
                      });
                    }}
                    aria-label={`Ver imagen ${item.originalName}`}
                  >
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className={styles.imageReviewThumb}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ) : (
                  <span className={styles.imageReviewThumb} aria-hidden />
                )}

                <div className={styles.imageReviewMeta}>
                  <span
                    className={styles.imageReviewName}
                    title={item.originalName}
                  >
                    {item.originalName}
                  </span>
                  {item.sourceRow ? (
                    <span className={styles.imageReviewDetail}>
                      Fila origen: {item.sourceRow}
                      {item.sourceColumn ? ` · ${item.sourceColumn}` : ""}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className={styles.imageReviewActionsRow}>
                <div className={styles.imageReviewComboboxWrap}>
                  <ProductSearchCombobox
                    options={products}
                    selectedId={selectedProductId}
                    onSelect={(productId) =>
                      handleProductSelect(item.id, productId)
                    }
                    disabled={disabled || isSubmitting}
                    placeholder="Buscar producto…"
                  />
                </div>
                <ImportYesNoRadio
                  name={`image-action-${item.id}`}
                  value={linkImage}
                  onChange={(link) => handleLinkChoice(item.id, link)}
                  disabled={disabled || isSubmitting}
                  yesDisabled={!selectedProductId}
                  yesLabel="Vincular"
                  noLabel="Ignorar"
                />
              </div>
            </article>
          );
        })}
      </div>

      {items.length < totalImages ? (
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => void loadMoreImages()}
          disabled={disabled || isSubmitting || isLoadingMoreImages}
        >
          {isLoadingMoreImages ? "Cargando más imágenes…" : "Cargar más imágenes"}
        </button>
      ) : null}

      {previewImage ? (
        <ProductImagePreviewModal
          imageUrl={previewImage.url}
          imageAlt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      ) : null}
    </div>
  );
}
