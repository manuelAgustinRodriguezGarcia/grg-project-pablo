"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import type { ProductTableItem } from "@/features/catalog/types/product-table.types";
import { formatProductFormColumnTitle } from "@/features/catalog/utils/column-title-display";
import { LINKED_EXTRA_IMAGE_LABEL } from "@/features/catalog/utils/linked-extra-image";
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
import { Image, Plus, X, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ProductFormModalProps = {
  folderId: string;
  folderName: string;
  columns: ColumnListItem[];
  product?: ProductTableItem | null;
  onClose: () => void;
  onSaved: () => void;
};

const MAX_FIELD_IMAGE_SLOTS = 2;

type FieldImageSlotSource = "product-image" | "annotation" | "new";

type FieldImageSlotDraft = {
  imageId: string | null;
  source: FieldImageSlotSource;
  previewUrl: string | null;
  pendingFile: File | null;
  removeImage: boolean;
};

type ImageRemovalTarget =
  | { kind: "linked"; slotIndex: number }
  | { kind: "field"; columnKey: string; slotIndex: number };

const LINKED_PRODUCT_IMAGE_KEY = "__linked_product_image__";

function createEmptyFieldSlot(): FieldImageSlotDraft {
  return {
    imageId: null,
    source: "new",
    previewUrl: null,
    pendingFile: null,
    removeImage: false,
  };
}

function slotHasVisibleImage(slot: FieldImageSlotDraft | undefined): boolean {
  return Boolean(slot?.previewUrl) && !slot?.removeImage;
}

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

function buildInitialFieldSlots(
  product: ProductTableItem | null | undefined,
  columnInternalKey: string,
): FieldImageSlotDraft[] {
  const columnImages = product?.imagesByColumnKey?.[columnInternalKey] ?? [];

  if (columnImages.length > 0) {
    return columnImages.slice(0, MAX_FIELD_IMAGE_SLOTS).map((image) => ({
      imageId: image.id,
      source: "product-image" as const,
      previewUrl: image.thumbnailUrl ?? image.fullUrl ?? null,
      pendingFile: null,
      removeImage: false,
    }));
  }

  const annotation = product?.fieldAnnotationsByColumnKey?.[columnInternalKey];
  const annotationUrl = annotation?.thumbnailUrl ?? annotation?.fullUrl ?? null;
  if (annotationUrl) {
    return [
      {
        imageId: null,
        source: "annotation",
        previewUrl: annotationUrl,
        pendingFile: null,
        removeImage: false,
      },
    ];
  }

  return [createEmptyFieldSlot()];
}

function buildInitialImageDrafts(
  editableColumns: ColumnListItem[],
  product?: ProductTableItem | null,
): Record<string, FieldImageSlotDraft[]> {
  const drafts: Record<string, FieldImageSlotDraft[]> = {};

  for (const column of editableColumns) {
    drafts[column.internalKey] = buildInitialFieldSlots(product, column.internalKey);
  }

  return drafts;
}

function getLinkedProductImagePreviewUrl(
  product: ProductTableItem | null | undefined,
): string | null {
  const primaryImage = product?.primaryImage;
  return primaryImage?.thumbnailUrl ?? primaryImage?.fullUrl ?? null;
}

function buildInitialLinkedImageSlots(
  product?: ProductTableItem | null,
): FieldImageSlotDraft[] {
  const slots: FieldImageSlotDraft[] = [
    {
      imageId: product?.primaryImage?.id ?? null,
      source: product?.primaryImage ? "product-image" : "new",
      previewUrl: getLinkedProductImagePreviewUrl(product),
      pendingFile: null,
      removeImage: false,
    },
  ];

  const extras = product?.extraImages ?? [];
  for (const image of extras.slice(0, MAX_FIELD_IMAGE_SLOTS - 1)) {
    slots.push({
      imageId: image.id,
      source: "product-image",
      previewUrl: image.thumbnailUrl ?? image.fullUrl ?? null,
      pendingFile: null,
      removeImage: false,
    });
  }

  return slots;
}

function buildInitialHadFieldImages(
  editableColumns: ColumnListItem[],
  product?: ProductTableItem | null,
): Record<string, boolean[]> {
  const initialHadImage: Record<string, boolean[]> = {};

  for (const column of editableColumns) {
    const slots = buildInitialFieldSlots(product, column.internalKey);
    initialHadImage[column.internalKey] = slots.map((slot) => Boolean(slot.previewUrl));
  }

  return initialHadImage;
}

function buildInitialHadLinkedImages(
  product?: ProductTableItem | null,
): boolean[] {
  return buildInitialLinkedImageSlots(product).map((slot) => Boolean(slot.previewUrl));
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
  imageDrafts: Record<string, FieldImageSlotDraft[]>,
): boolean {
  for (const column of editableColumns) {
    const slots = imageDrafts[column.internalKey] ?? [];
    for (const slot of slots) {
      if (slot.pendingFile || slot.removeImage) {
        return true;
      }
    }
  }

  return false;
}

function hasLinkedImageSlotChanges(slots: FieldImageSlotDraft[]): boolean {
  return slots.some((slot) => Boolean(slot.pendingFile || slot.removeImage));
}

function slotFileInputKey(columnKey: string, slotIndex: number): string {
  return `${columnKey}::${slotIndex}`;
}

function autoResizeTextarea(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function mergeImageSlots(
  currentSlots: FieldImageSlotDraft[],
  refreshedSlots: FieldImageSlotDraft[],
): FieldImageSlotDraft[] {
  const hasLocalEdits = currentSlots.some(
    (slot) => slot.pendingFile || slot.removeImage,
  );
  const userExpandedSecondSlot = currentSlots.length > refreshedSlots.length;

  if (hasLocalEdits || userExpandedSecondSlot) {
    return currentSlots;
  }

  return refreshedSlots;
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
  // Field dropzones are always available; ZIP folders also keep COL 0 linked image.
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
  const [imageDrafts, setImageDrafts] = useState<Record<string, FieldImageSlotDraft[]>>(
    () => buildInitialImageDrafts(editableColumns, product),
  );
  const [linkedImageSlots, setLinkedImageSlots] = useState<FieldImageSlotDraft[]>(() =>
    buildInitialLinkedImageSlots(product),
  );
  const [imageRemovalTarget, setImageRemovalTarget] = useState<ImageRemovalTarget | null>(
    null,
  );
  const initialHadFieldImages = useMemo(
    () => buildInitialHadFieldImages(editableColumns, product),
    [editableColumns, product],
  );
  const initialHadLinkedImages = useMemo(
    () => buildInitialHadLinkedImages(product),
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
    setLinkedImageSlots(buildInitialLinkedImageSlots(product));
  }, [editableColumns, product]);

  useEffect(() => {
    resizeAllTextareas();
  }, [editableColumns, resizeAllTextareas, values]);

  useEffect(() => {
    if (!isEditMode || !product?.id) {
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
          const merged: Record<string, FieldImageSlotDraft[]> = {};

          for (const column of editableColumns) {
            const key = column.internalKey;
            merged[key] = mergeImageSlots(
              current[key] ?? [],
              refreshed[key] ?? [createEmptyFieldSlot()],
            );
          }

          return merged;
        });

        if (showLinkedProductImage) {
          setLinkedImageSlots((current) =>
            mergeImageSlots(current, buildInitialLinkedImageSlots(detail)),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editableColumns, isEditMode, product?.id, showLinkedProductImage]);

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

  function handleSelectFieldImage(
    columnKey: string,
    slotIndex: number,
    file: File | null,
  ) {
    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImageDrafts((current) => {
      const slots = [...(current[columnKey] ?? [createEmptyFieldSlot()])];
      const existing = slots[slotIndex] ?? createEmptyFieldSlot();
      slots[slotIndex] = {
        ...existing,
        pendingFile: file,
        previewUrl,
        removeImage: false,
      };
      return { ...current, [columnKey]: slots };
    });
  }

  function handleSelectLinkedImage(slotIndex: number, file: File | null) {
    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLinkedImageSlots((current) => {
      const slots = [...current];
      const existing = slots[slotIndex] ?? createEmptyFieldSlot();
      slots[slotIndex] = {
        ...existing,
        pendingFile: file,
        previewUrl,
        removeImage: false,
      };
      return slots;
    });
  }

  function handleRemoveFieldImage(columnKey: string, slotIndex: number) {
    setImageDrafts((current) => {
      const slots = [...(current[columnKey] ?? [])];
      const existing = slots[slotIndex];
      if (!existing) {
        return current;
      }

      slots[slotIndex] = {
        ...existing,
        pendingFile: null,
        previewUrl: null,
        removeImage: true,
      };
      return { ...current, [columnKey]: slots };
    });
  }

  function handleRemoveLinkedImage(slotIndex: number) {
    setLinkedImageSlots((current) => {
      const slots = [...current];
      const existing = slots[slotIndex];
      if (!existing) {
        return current;
      }

      slots[slotIndex] = {
        ...existing,
        pendingFile: null,
        previewUrl: null,
        removeImage: true,
      };
      return slots;
    });
  }

  function handleAddFieldImageSlot(columnKey: string) {
    setImageDrafts((current) => {
      const slots = current[columnKey] ?? [createEmptyFieldSlot()];
      if (slots.length >= MAX_FIELD_IMAGE_SLOTS) {
        return current;
      }

      if (!slotHasVisibleImage(slots[0])) {
        return current;
      }

      return {
        ...current,
        [columnKey]: [...slots, createEmptyFieldSlot()],
      };
    });
  }

  function handleAddLinkedImageSlot() {
    setLinkedImageSlots((current) => {
      if (current.length >= MAX_FIELD_IMAGE_SLOTS) {
        return current;
      }

      if (!slotHasVisibleImage(current[0])) {
        return current;
      }

      return [...current, createEmptyFieldSlot()];
    });
  }

  function shouldConfirmFieldImageRemoval(
    columnKey: string,
    slotIndex: number,
  ): boolean {
    const slot = imageDrafts[columnKey]?.[slotIndex];
    if (!slot?.previewUrl) {
      return false;
    }

    if (slot.pendingFile) {
      return false;
    }

    return initialHadFieldImages[columnKey]?.[slotIndex] ?? false;
  }

  function shouldConfirmLinkedImageRemoval(slotIndex: number): boolean {
    const slot = linkedImageSlots[slotIndex];
    if (!slot?.previewUrl || slot.pendingFile) {
      return false;
    }

    return initialHadLinkedImages[slotIndex] ?? false;
  }

  function requestRemoveFieldImage(columnKey: string, slotIndex: number) {
    if (shouldConfirmFieldImageRemoval(columnKey, slotIndex)) {
      setImageRemovalTarget({ kind: "field", columnKey, slotIndex });
      return;
    }

    handleRemoveFieldImage(columnKey, slotIndex);
  }

  function requestRemoveLinkedImage(slotIndex: number) {
    if (shouldConfirmLinkedImageRemoval(slotIndex)) {
      setImageRemovalTarget({ kind: "linked", slotIndex });
      return;
    }

    handleRemoveLinkedImage(slotIndex);
  }

  function confirmRemoveImage() {
    if (!imageRemovalTarget) {
      return;
    }

    if (imageRemovalTarget.kind === "linked") {
      handleRemoveLinkedImage(imageRemovalTarget.slotIndex);
    } else {
      handleRemoveFieldImage(
        imageRemovalTarget.columnKey,
        imageRemovalTarget.slotIndex,
      );
    }

    setImageRemovalTarget(null);
  }

  async function persistLinkedProductImages(productId: string): Promise<string | null> {
    if (!showLinkedProductImage) {
      return null;
    }

    for (let slotIndex = 0; slotIndex < linkedImageSlots.length; slotIndex += 1) {
      const slot = linkedImageSlots[slotIndex];
      if (!slot) {
        continue;
      }

      const isPrimarySlot = slotIndex === 0;

      if (slot.removeImage && !slot.pendingFile && isEditMode && slot.imageId) {
        const result = await deleteProductLinkedImage(productId, slot.imageId);
        if (!result.success) {
          return result.error;
        }
        continue;
      }

      if (!slot.pendingFile) {
        continue;
      }

      if (slot.imageId && slot.source === "product-image") {
        const result = await replaceProductLinkedImage(
          productId,
          slot.imageId,
          slot.pendingFile,
        );
        if (!result.success) {
          return result.error;
        }
        continue;
      }

      const result = await uploadProductLinkedImage(productId, slot.pendingFile, {
        isPrimary: isPrimarySlot,
        label: isPrimarySlot ? undefined : LINKED_EXTRA_IMAGE_LABEL,
        sortOrder: slotIndex,
      });
      if (!result.success) {
        return result.error;
      }
    }

    return null;
  }

  async function persistFieldImages(productId: string): Promise<string | null> {
    for (const column of editableColumns) {
      const slots = imageDrafts[column.internalKey] ?? [];

      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const slot = slots[slotIndex];
        if (!slot) {
          continue;
        }

        if (slot.removeImage && !slot.pendingFile && isEditMode) {
          if (slot.source === "annotation") {
            const result = await deleteProductFieldHelpImage(
              productId,
              column.internalKey,
            );
            if (!result.success) {
              return result.error;
            }
          } else if (slot.imageId) {
            const result = await deleteProductLinkedImage(productId, slot.imageId);
            if (!result.success) {
              return result.error;
            }
          }
          continue;
        }

        if (!slot.pendingFile) {
          continue;
        }

        if (slot.imageId && slot.source === "product-image") {
          const result = await replaceProductLinkedImage(
            productId,
            slot.imageId,
            slot.pendingFile,
          );
          if (!result.success) {
            return result.error;
          }
          continue;
        }

        if (slot.source === "annotation") {
          // Replacing a legacy annotation image: keep using the annotation endpoint
          // when it is the only slot; otherwise promote to a labeled product image.
          if (slots.length === 1) {
            const result = await uploadProductFieldHelpImage(
              productId,
              column.internalKey,
              slot.pendingFile,
            );
            if (!result.success) {
              return result.error;
            }
          } else {
            const deleteResult = await deleteProductFieldHelpImage(
              productId,
              column.internalKey,
            );
            if (!deleteResult.success) {
              return deleteResult.error;
            }

            const result = await uploadProductLinkedImage(
              productId,
              slot.pendingFile,
              {
                isPrimary: false,
                label: column.internalKey,
                sortOrder: slotIndex,
              },
            );
            if (!result.success) {
              return result.error;
            }
          }
          continue;
        }

        const result = await uploadProductLinkedImage(productId, slot.pendingFile, {
          isPrimary: false,
          label: column.internalKey,
          sortOrder: slotIndex,
        });
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
      // En edición hay que enviar vacíos para poder limpiar el campo en BD.
      // En alta, omitimos vacíos (opcionales quedan sin valor).
      if (!isEditMode && raw.trim() === "") {
        continue;
      }
      payloadValues[column.internalKey] = raw.trim() === "" ? "" : raw;
    }

    const needsProductPatch =
      !isEditMode || hasValueChanges(editableColumns, values, product);
    const needsLinkedImagePersist =
      showLinkedProductImage && hasLinkedImageSlotChanges(linkedImageSlots);
    const needsFieldImagePersist = hasFieldImageDraftChanges(
      editableColumns,
      imageDrafts,
    );

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
        ? await persistLinkedProductImages(productId)
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

  const canAddLinkedSecondSlot =
    showLinkedProductImage &&
    linkedImageSlots.length === 1 &&
    slotHasVisibleImage(linkedImageSlots[0]);

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
                      <div className={styles.productFormImageSlots}>
                        {linkedImageSlots.map((slot, slotIndex) => {
                          const inputKey = slotFileInputKey(
                            LINKED_PRODUCT_IMAGE_KEY,
                            slotIndex,
                          );
                          const hasPreview = slotHasVisibleImage(slot);

                          return (
                            <div key={inputKey} className={styles.productFormImageSlot}>
                              {hasPreview ? (
                                <div
                                  className={`${styles.productFormImageDropzone} ${styles.productFormImageDropzoneFilled}`}
                                >
                                  <button
                                    type="button"
                                    className={styles.productFormImagePreviewButton}
                                    onClick={() =>
                                      fileInputRefs.current[inputKey]?.click()
                                    }
                                    disabled={isSaving}
                                    aria-label={`Reemplazar imagen ${slotIndex + 1} de ${linkedImageTitle}`}
                                  >
                                    <img
                                      src={slot.previewUrl ?? ""}
                                      alt=""
                                      className={styles.productFormImagePreviewImg}
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.productFormImageRemove}
                                    onClick={() => requestRemoveLinkedImage(slotIndex)}
                                    disabled={isSaving}
                                    aria-label={`Quitar imagen ${slotIndex + 1} de ${linkedImageTitle}`}
                                  >
                                    <X strokeWidth={ICON_STROKE} aria-hidden />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.productFormImageDropzone}
                                  onClick={() =>
                                    fileInputRefs.current[inputKey]?.click()
                                  }
                                  disabled={isSaving}
                                  aria-label={`Agregar imagen ${slotIndex + 1} a ${linkedImageTitle}`}
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
                                  fileInputRefs.current[inputKey] = element;
                                }}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className={styles.columnEditHiddenInput}
                                onChange={(event) => {
                                  handleSelectLinkedImage(
                                    slotIndex,
                                    event.target.files?.[0] ?? null,
                                  );
                                  event.currentTarget.value = "";
                                }}
                              />
                            </div>
                          );
                        })}

                        {canAddLinkedSecondSlot ? (
                          <button
                            type="button"
                            className={styles.productFormImageAddSlot}
                            onClick={handleAddLinkedImageSlot}
                            disabled={isSaving}
                            aria-label={`Agregar segunda imagen a ${linkedImageTitle}`}
                            title="Agregar otra imagen"
                          >
                            <Plus strokeWidth={ICON_STROKE} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {editableColumns.map((column, columnIndex) => {
                const slots = imageDrafts[column.internalKey] ?? [createEmptyFieldSlot()];
                const canAddSecondSlot =
                  slots.length === 1 && slotHasVisibleImage(slots[0]);
                const columnTitle = formatProductFormColumnTitle(
                  columnIndex + 1,
                  column.displayName,
                );

                return (
                  <div key={column.id} className={styles.productFormFieldCard}>
                    <div className={styles.productFormColumnTitle}>{columnTitle}</div>
                    <div className={styles.productFormFieldBody}>
                      <div className={styles.productFormImageWrap}>
                        <div className={styles.productFormImageSlots}>
                          {slots.map((slot, slotIndex) => {
                            const inputKey = slotFileInputKey(
                              column.internalKey,
                              slotIndex,
                            );
                            const hasPreview = slotHasVisibleImage(slot);

                            return (
                              <div key={inputKey} className={styles.productFormImageSlot}>
                                {hasPreview ? (
                                  <div
                                    className={`${styles.productFormImageDropzone} ${styles.productFormImageDropzoneFilled}`}
                                  >
                                    <button
                                      type="button"
                                      className={styles.productFormImagePreviewButton}
                                      onClick={() =>
                                        fileInputRefs.current[inputKey]?.click()
                                      }
                                      disabled={isSaving}
                                      aria-label={`Reemplazar imagen ${slotIndex + 1} de ${columnTitle}`}
                                    >
                                      <img
                                        src={slot.previewUrl ?? ""}
                                        alt=""
                                        className={styles.productFormImagePreviewImg}
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.productFormImageRemove}
                                      onClick={() =>
                                        requestRemoveFieldImage(
                                          column.internalKey,
                                          slotIndex,
                                        )
                                      }
                                      disabled={isSaving}
                                      aria-label={`Quitar imagen ${slotIndex + 1} de ${columnTitle}`}
                                    >
                                      <X strokeWidth={ICON_STROKE} aria-hidden />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className={styles.productFormImageDropzone}
                                    onClick={() =>
                                      fileInputRefs.current[inputKey]?.click()
                                    }
                                    disabled={isSaving}
                                    aria-label={`Agregar imagen ${slotIndex + 1} a ${columnTitle}`}
                                  >
                                    <Image
                                      className={styles.productFormImageDropzoneIcon}
                                      strokeWidth={ICON_STROKE}
                                      aria-hidden
                                    />
                                    <span
                                      className={styles.productFormImageDropzoneLabel}
                                    >
                                      Imagen
                                    </span>
                                  </button>
                                )}
                                <input
                                  ref={(element) => {
                                    fileInputRefs.current[inputKey] = element;
                                  }}
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className={styles.columnEditHiddenInput}
                                  onChange={(event) => {
                                    handleSelectFieldImage(
                                      column.internalKey,
                                      slotIndex,
                                      event.target.files?.[0] ?? null,
                                    );
                                    event.currentTarget.value = "";
                                  }}
                                />
                              </div>
                            );
                          })}

                          {canAddSecondSlot ? (
                            <button
                              type="button"
                              className={styles.productFormImageAddSlot}
                              onClick={() => handleAddFieldImageSlot(column.internalKey)}
                              disabled={isSaving}
                              aria-label={`Agregar segunda imagen a ${columnTitle}`}
                              title="Agregar otra imagen"
                            >
                              <Plus strokeWidth={ICON_STROKE} aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </div>

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
            imageRemovalTarget.kind === "linked"
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
