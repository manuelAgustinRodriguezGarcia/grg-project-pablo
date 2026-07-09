"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import type { ProductTableItem } from "@/features/catalog/types/product-table.types";
import { formatProductFormColumnTitle } from "@/features/catalog/utils/column-title-display";
import {
  folderHasLinkedImages,
  isGeneratedPrimaryCodeColumn,
  isImageCodeColumn,
} from "@/features/catalog/utils/product-table-columns";
import {
  deleteProductFieldHelpImage,
  uploadProductFieldHelpImage,
} from "@/features/catalog/utils/product-field-annotation.client";
import {
  deleteProductLinkedImage,
  replaceProductLinkedImage,
  uploadProductLinkedImage,
} from "@/features/catalog/utils/product-linked-image.client";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import { Image, X, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ProductFormModalProps = {
  folderId: string;
  folderName: string;
  columns: ColumnListItem[];
  product?: ProductTableItem | null;
  onClose: () => void;
  onSaved: () => void;
};

type FieldImageDraft = {
  previewUrl: string | null;
  pendingFile: File | null;
  removeImage: boolean;
};

type LinkedProductImageDraft = {
  imageId: string | null;
  previewUrl: string | null;
  pendingFile: File | null;
  removeImage: boolean;
};

const LINKED_PRODUCT_IMAGE_KEY = "__linked_product_image__";

function getEditableColumns(columns: ColumnListItem[]): ColumnListItem[] {
  return columns.filter(
    (column) =>
      column.isAdminEditable &&
      !column.isReadOnly &&
      !isGeneratedPrimaryCodeColumn(column) &&
      !isImageCodeColumn(column),
  );
}

function getFieldValue(product: ProductTableItem, column: ColumnListItem): string {
  if (column.isPrimaryCode) {
    return product.primaryCode ?? "";
  }

  if (column.isDescription) {
    return product.description ?? "";
  }

  const dynamicValue = product.dynamicData[column.internalKey];
  if (dynamicValue === null || dynamicValue === undefined) {
    return "";
  }

  return String(dynamicValue);
}

function buildInitialValues(
  editableColumns: ColumnListItem[],
  product?: ProductTableItem | null,
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const column of editableColumns) {
    values[column.internalKey] = product ? getFieldValue(product, column) : "";
  }

  return values;
}

function getFieldImagePreviewUrl(
  product: ProductTableItem | null | undefined,
  columnInternalKey: string,
): string | null {
  const annotation = product?.fieldAnnotationsByColumnKey?.[columnInternalKey];
  const annotationUrl = annotation?.thumbnailUrl ?? annotation?.fullUrl ?? null;
  if (annotationUrl) {
    return annotationUrl;
  }

  const linkedImage = product?.imagesByColumnKey?.[columnInternalKey]?.[0];
  return linkedImage?.thumbnailUrl ?? linkedImage?.fullUrl ?? null;
}

function buildInitialImageDrafts(
  editableColumns: ColumnListItem[],
  product?: ProductTableItem | null,
): Record<string, FieldImageDraft> {
  const drafts: Record<string, FieldImageDraft> = {};

  for (const column of editableColumns) {
    drafts[column.internalKey] = {
      previewUrl: getFieldImagePreviewUrl(product, column.internalKey),
      pendingFile: null,
      removeImage: false,
    };
  }

  return drafts;
}

function getLinkedProductImagePreviewUrl(
  product: ProductTableItem | null | undefined,
): string | null {
  const primaryImage = product?.primaryImage;
  return primaryImage?.thumbnailUrl ?? primaryImage?.fullUrl ?? null;
}

function buildInitialLinkedImageDraft(
  product?: ProductTableItem | null,
): LinkedProductImageDraft {
  return {
    imageId: product?.primaryImage?.id ?? null,
    previewUrl: getLinkedProductImagePreviewUrl(product),
    pendingFile: null,
    removeImage: false,
  };
}

function buildInitialHadImage(
  editableColumns: ColumnListItem[],
  product?: ProductTableItem | null,
): Record<string, boolean> {
  const initialHadImage: Record<string, boolean> = {};

  for (const column of editableColumns) {
    initialHadImage[column.internalKey] = Boolean(
      getFieldImagePreviewUrl(product, column.internalKey),
    );
  }

  return initialHadImage;
}

function hasValueChanges(
  editableColumns: ColumnListItem[],
  values: Record<string, string>,
  product: ProductTableItem | null | undefined,
): boolean {
  if (!product) {
    return Object.values(values).some((value) => value.trim() !== "");
  }

  for (const column of editableColumns) {
    const current = values[column.internalKey] ?? "";
    const initial = getFieldValue(product, column);
    if (current !== initial) {
      return true;
    }
  }

  return false;
}

function hasFieldImageDraftChanges(
  editableColumns: ColumnListItem[],
  imageDrafts: Record<string, FieldImageDraft>,
): boolean {
  for (const column of editableColumns) {
    const draft = imageDrafts[column.internalKey];
    if (draft?.pendingFile || draft?.removeImage) {
      return true;
    }
  }

  return false;
}

function hasLinkedImageDraftChanges(draft: LinkedProductImageDraft): boolean {
  return Boolean(draft.pendingFile || draft.removeImage);
}

function autoResizeTextarea(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

export function ProductFormModal({
  folderId,
  folderName,
  columns,
  product = null,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const isEditMode = product !== null && product !== undefined;
  const editableColumns = useMemo(() => getEditableColumns(columns), [columns]);
  const showFieldImages = useMemo(() => !folderHasLinkedImages(columns), [columns]);
  const showLinkedProductImage = useMemo(
    () => folderHasLinkedImages(columns),
    [columns],
  );
  const linkedImageTitle = useMemo(
    () => formatProductFormColumnTitle(0, "IMAGEN"),
    [],
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialValues(editableColumns, product),
  );
  const [imageDrafts, setImageDrafts] = useState<Record<string, FieldImageDraft>>(() =>
    buildInitialImageDrafts(editableColumns, product),
  );
  const [linkedImageDraft, setLinkedImageDraft] = useState<LinkedProductImageDraft>(() =>
    buildInitialLinkedImageDraft(product),
  );
  const [imageRemovalTarget, setImageRemovalTarget] = useState<string | null>(null);
  const initialHadImage = useMemo(
    () => buildInitialHadImage(editableColumns, product),
    [editableColumns, product],
  );
  const initialHadLinkedImage = useMemo(
    () => Boolean(getLinkedProductImagePreviewUrl(product)),
    [product],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const resizeAllTextareas = useCallback(() => {
    for (const element of Object.values(textareaRefs.current)) {
      if (element) {
        autoResizeTextarea(element);
      }
    }
  }, []);

  useEffect(() => {
    setValues(buildInitialValues(editableColumns, product));
    setImageDrafts(buildInitialImageDrafts(editableColumns, product));
    setLinkedImageDraft(buildInitialLinkedImageDraft(product));
  }, [editableColumns, product]);

  useEffect(() => {
    resizeAllTextareas();
  }, [editableColumns, resizeAllTextareas, values]);

  useEffect(() => {
    if (!isEditMode || !product?.id || !showFieldImages) {
      return;
    }

    let cancelled = false;

    void fetch(`/api/admin/products/${product.id}`)
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as ProductTableItem;
      })
      .then((detail) => {
        if (!detail || cancelled) {
          return;
        }

        setImageDrafts((current) => {
          const refreshed = buildInitialImageDrafts(editableColumns, detail);
          const merged: Record<string, FieldImageDraft> = {};

          for (const column of editableColumns) {
            const key = column.internalKey;
            const currentDraft = current[key];

            if (currentDraft?.pendingFile || currentDraft?.removeImage) {
              merged[key] = currentDraft;
              continue;
            }

            merged[key] = refreshed[key] ?? currentDraft;
          }

          return merged;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [editableColumns, isEditMode, product?.id, showFieldImages]);

  useEffect(() => {
    if (!isEditMode || !product?.id || !showLinkedProductImage) {
      return;
    }

    let cancelled = false;

    void fetch(`/api/admin/products/${product.id}`)
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as ProductTableItem;
      })
      .then((detail) => {
        if (!detail || cancelled) {
          return;
        }

        setLinkedImageDraft((current) => {
          if (current.pendingFile || current.removeImage) {
            return current;
          }

          return buildInitialLinkedImageDraft(detail);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isEditMode, product?.id, showLinkedProductImage]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  function updateValue(internalKey: string, value: string) {
    setValues((current) => ({ ...current, [internalKey]: value }));
  }

  function handleSelectImage(internalKey: string, file: File | null) {
    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImageDrafts((current) => ({
      ...current,
      [internalKey]: {
        ...current[internalKey],
        pendingFile: file,
        previewUrl,
        removeImage: false,
      },
    }));
  }

  function handleSelectLinkedImage(file: File | null) {
    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLinkedImageDraft((current) => ({
      ...current,
      pendingFile: file,
      previewUrl,
      removeImage: false,
    }));
  }

  function handleRemoveImage(internalKey: string) {
    setImageDrafts((current) => ({
      ...current,
      [internalKey]: {
        ...current[internalKey],
        pendingFile: null,
        previewUrl: null,
        removeImage: true,
      },
    }));
  }

  function handleRemoveLinkedImage() {
    setLinkedImageDraft((current) => ({
      ...current,
      pendingFile: null,
      previewUrl: null,
      removeImage: true,
    }));
  }

  function shouldConfirmImageRemoval(internalKey: string): boolean {
    if (internalKey === LINKED_PRODUCT_IMAGE_KEY) {
      if (!linkedImageDraft.previewUrl || linkedImageDraft.pendingFile) {
        return false;
      }

      return initialHadLinkedImage;
    }

    const draft = imageDrafts[internalKey];
    if (!draft?.previewUrl) {
      return false;
    }

    if (draft.pendingFile) {
      return false;
    }

    return initialHadImage[internalKey] ?? false;
  }

  function requestRemoveImage(internalKey: string) {
    if (shouldConfirmImageRemoval(internalKey)) {
      setImageRemovalTarget(internalKey);
      return;
    }

    handleRemoveImage(internalKey);
  }

  function confirmRemoveImage() {
    if (!imageRemovalTarget) {
      return;
    }

    if (imageRemovalTarget === LINKED_PRODUCT_IMAGE_KEY) {
      handleRemoveLinkedImage();
    } else {
      handleRemoveImage(imageRemovalTarget);
    }

    setImageRemovalTarget(null);
  }

  async function persistLinkedProductImage(productId: string): Promise<string | null> {
    if (!showLinkedProductImage) {
      return null;
    }

    if (
      linkedImageDraft.removeImage &&
      !linkedImageDraft.pendingFile &&
      linkedImageDraft.imageId
    ) {
      const result = await deleteProductLinkedImage(
        productId,
        linkedImageDraft.imageId,
      );
      if (!result.success) {
        return result.error;
      }
    }

    if (linkedImageDraft.pendingFile) {
      if (linkedImageDraft.imageId) {
        const result = await replaceProductLinkedImage(
          productId,
          linkedImageDraft.imageId,
          linkedImageDraft.pendingFile,
        );
        if (!result.success) {
          return result.error;
        }
      } else {
        const result = await uploadProductLinkedImage(
          productId,
          linkedImageDraft.pendingFile,
        );
        if (!result.success) {
          return result.error;
        }
      }
    }

    return null;
  }

  async function persistFieldImages(productId: string): Promise<string | null> {
    if (!showFieldImages) {
      return null;
    }

    for (const column of editableColumns) {
      const draft = imageDrafts[column.internalKey];
      if (!draft) {
        continue;
      }

      if (draft.removeImage && isEditMode) {
        const result = await deleteProductFieldHelpImage(productId, column.internalKey);
        if (!result.success) {
          return result.error;
        }
        continue;
      }

      if (draft.pendingFile) {
        const result = await uploadProductFieldHelpImage(
          productId,
          column.internalKey,
          draft.pendingFile,
        );
        if (!result.success) {
          return result.error;
        }
      }
    }

    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const payloadValues: Record<string, unknown> = {};
    for (const column of editableColumns) {
      const raw = values[column.internalKey] ?? "";
      if (raw.trim() === "") {
        continue;
      }
      payloadValues[column.internalKey] = raw;
    }

    const fieldAnnotations: Record<string, { removeImage?: boolean }> = {};

    if (showFieldImages) {
      for (const column of editableColumns) {
        const draft = imageDrafts[column.internalKey];
        if (!draft?.removeImage) {
          continue;
        }

        fieldAnnotations[column.internalKey] = { removeImage: true };
      }
    }

    const needsProductPatch =
      !isEditMode ||
      hasValueChanges(editableColumns, values, product) ||
      Object.keys(fieldAnnotations).length > 0;
    const needsLinkedImagePersist =
      showLinkedProductImage && hasLinkedImageDraftChanges(linkedImageDraft);
    const needsFieldImagePersist =
      showFieldImages && hasFieldImageDraftChanges(editableColumns, imageDrafts);

    if (
      isEditMode &&
      !needsProductPatch &&
      !needsLinkedImagePersist &&
      !needsFieldImagePersist
    ) {
      onSaved();
      onClose();
      setIsSaving(false);
      return;
    }

    try {
      let productId = product?.id;

      if (isEditMode && productId) {
        if (needsProductPatch) {
          const response = await fetch(`/api/admin/products/${productId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              values: payloadValues,
              fieldAnnotations:
                Object.keys(fieldAnnotations).length > 0 ? fieldAnnotations : undefined,
            }),
          });

          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;

          if (!response.ok) {
            setError(payload?.error ?? "No se pudo actualizar el producto.");
            return;
          }
        }
      } else {
        const response = await fetch(`/api/admin/folders/${folderId}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            values: payloadValues,
            fieldAnnotations:
              Object.keys(fieldAnnotations).length > 0 ? fieldAnnotations : undefined,
          }),
        });

        const payload = (await response.json().catch(() => null)) as {
          id?: string;
          error?: string;
        } | null;

        if (!response.ok || !payload?.id) {
          setError(payload?.error ?? "No se pudo crear el producto.");
          return;
        }

        productId = payload.id;
      }

      const linkedImageError = needsLinkedImagePersist
        ? await persistLinkedProductImage(productId)
        : null;
      if (linkedImageError) {
        setError(linkedImageError);
        return;
      }

      const imageError = needsFieldImagePersist
        ? await persistFieldImages(productId)
        : null;
      if (imageError) {
        setError(imageError);
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError(
        isEditMode ? "No se pudo actualizar el producto." : "No se pudo crear el producto.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return createPortal(
    <div
      className={styles.columnEditOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        className={`${styles.columnEditCard} ${styles.columnEditCardFullscreen}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
      >
        <div className={styles.columnEditHeader}>
          <div>
            <h3 id="product-form-title" className={styles.columnEditTitle}>
              {isEditMode ? "Editar producto" : "Agregar producto"}
            </h3>
            <p className={styles.columnEditSubtitle}>Carpeta: {folderName}</p>
          </div>
          <button
            type="button"
            className={styles.columnEditClose}
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar"
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>

        {editableColumns.length === 0 ? (
          <p className={styles.columnEditError}>
            Esta carpeta no tiene columnas editables configuradas. Importá un Excel o
            configurá columnas primero.
          </p>
        ) : (
          <form
            className={styles.productForm}
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className={styles.productFormGrid}>
              {showLinkedProductImage ? (
                <div className={styles.productFormFieldCard}>
                  <div className={styles.productFormColumnTitle}>{linkedImageTitle}</div>
                  <div className={styles.productFormFieldBody}>
                    <div className={styles.productFormImageWrap}>
                      {linkedImageDraft.previewUrl ? (
                        <div
                          className={`${styles.productFormImageDropzone} ${styles.productFormImageDropzoneFilled}`}
                        >
                          <button
                            type="button"
                            className={styles.productFormImagePreviewButton}
                            onClick={() =>
                              fileInputRefs.current[LINKED_PRODUCT_IMAGE_KEY]?.click()
                            }
                            disabled={isSaving}
                            aria-label={`Reemplazar ${linkedImageTitle}`}
                          >
                            <img
                              src={linkedImageDraft.previewUrl}
                              alt=""
                              className={styles.productFormImagePreviewImg}
                            />
                          </button>
                          <button
                            type="button"
                            className={styles.productFormImageRemove}
                            onClick={() =>
                              requestRemoveImage(LINKED_PRODUCT_IMAGE_KEY)
                            }
                            disabled={isSaving}
                            aria-label={`Quitar ${linkedImageTitle}`}
                          >
                            <X strokeWidth={ICON_STROKE} aria-hidden />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={styles.productFormImageDropzone}
                          onClick={() =>
                            fileInputRefs.current[LINKED_PRODUCT_IMAGE_KEY]?.click()
                          }
                          disabled={isSaving}
                          aria-label={`Agregar ${linkedImageTitle}`}
                        >
                          <Image
                            className={styles.productFormImageDropzoneIcon}
                            strokeWidth={ICON_STROKE}
                            aria-hidden
                          />
                          <span className={styles.productFormImageDropzoneLabel}>
                            Imagen
                          </span>
                        </button>
                      )}
                      <input
                        ref={(element) => {
                          fileInputRefs.current[LINKED_PRODUCT_IMAGE_KEY] = element;
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className={styles.columnEditHiddenInput}
                        onChange={(event) =>
                          handleSelectLinkedImage(event.target.files?.[0] ?? null)
                        }
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {editableColumns.map((column, columnIndex) => {
                const imageDraft = imageDrafts[column.internalKey];
                const hasPreview = Boolean(imageDraft?.previewUrl);
                const columnTitle = formatProductFormColumnTitle(
                  columnIndex + 1,
                  column.displayName,
                );

                return (
                  <div key={column.id} className={styles.productFormFieldCard}>
                    <div className={styles.productFormColumnTitle}>{columnTitle}</div>
                    <div className={styles.productFormFieldBody}>
                      {showFieldImages ? (
                        <div className={styles.productFormImageWrap}>
                          {hasPreview ? (
                            <div
                              className={`${styles.productFormImageDropzone} ${styles.productFormImageDropzoneFilled}`}
                            >
                              <button
                                type="button"
                                className={styles.productFormImagePreviewButton}
                                onClick={() =>
                                  fileInputRefs.current[column.internalKey]?.click()
                                }
                                disabled={isSaving}
                                aria-label={`Reemplazar imagen de ${columnTitle}`}
                              >
                                <img
                                  src={imageDraft?.previewUrl ?? ""}
                                  alt=""
                                  className={styles.productFormImagePreviewImg}
                                />
                              </button>
                              <button
                                type="button"
                                className={styles.productFormImageRemove}
                                onClick={() => requestRemoveImage(column.internalKey)}
                                disabled={isSaving}
                                aria-label={`Quitar imagen de ${columnTitle}`}
                              >
                                <X strokeWidth={ICON_STROKE} aria-hidden />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className={styles.productFormImageDropzone}
                              onClick={() =>
                                fileInputRefs.current[column.internalKey]?.click()
                              }
                              disabled={isSaving}
                              aria-label={`Agregar imagen a ${columnTitle}`}
                            >
                              <Image
                                className={styles.productFormImageDropzoneIcon}
                                strokeWidth={ICON_STROKE}
                                aria-hidden
                              />
                              <span className={styles.productFormImageDropzoneLabel}>
                                Imagen
                              </span>
                            </button>
                          )}
                          <input
                            ref={(element) => {
                              fileInputRefs.current[column.internalKey] = element;
                            }}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className={styles.columnEditHiddenInput}
                            onChange={(event) =>
                              handleSelectImage(
                                column.internalKey,
                                event.target.files?.[0] ?? null,
                              )
                            }
                          />
                        </div>
                      ) : null}

                      <textarea
                        ref={(element) => {
                          textareaRefs.current[column.internalKey] = element;
                          if (element) {
                            autoResizeTextarea(element);
                          }
                        }}
                        className={styles.productFormTextarea}
                        value={values[column.internalKey] ?? ""}
                        onChange={(event) => {
                          updateValue(column.internalKey, event.target.value);
                          autoResizeTextarea(event.currentTarget);
                        }}
                        disabled={isSaving}
                        required={column.isRequired}
                        rows={1}
                        aria-label={columnTitle}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {error ? (
              <p className={styles.columnEditError} role="alert">
                {error}
              </p>
            ) : null}

            <div className={styles.columnEditActions}>
              <button
                type="button"
                className={styles.confirmCancelButton}
                onClick={onClose}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.confirmPrimaryButton}
                disabled={isSaving}
              >
                {isSaving
                  ? "Guardando…"
                  : isEditMode
                    ? "Guardar cambios"
                    : "Crear producto"}
              </button>
            </div>
          </form>
        )}
      </div>
      {imageRemovalTarget ? (
        <ConfirmDialog
          title="Eliminar imagen"
          message={
            imageRemovalTarget === LINKED_PRODUCT_IMAGE_KEY
              ? "La imagen eliminada no podrá recuperarse. ¿Desea quitarla del producto?"
              : "La imagen eliminada no podrá recuperarse. ¿Desea quitarla de esta columna?"
          }
          confirmLabel="Eliminar imagen"
          variant="danger"
          onConfirm={confirmRemoveImage}
          onCancel={() => setImageRemovalTarget(null)}
          overlayClassName={styles.confirmOverlayElevated}
        />
      ) : null}
    </div>,
    document.body,
  );
}
