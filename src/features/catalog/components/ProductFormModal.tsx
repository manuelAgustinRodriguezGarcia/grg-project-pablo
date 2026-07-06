"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import type { ProductTableItem } from "@/features/catalog/types/product-table.types";
import { formatColumnTitleForDisplay } from "@/features/catalog/utils/column-title-display";
import { isGeneratedPrimaryCodeColumn } from "@/features/catalog/utils/product-table-columns";
import {
  deleteProductFieldHelpImage,
  uploadProductFieldHelpImage,
} from "@/features/catalog/utils/product-field-annotation.client";
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

type FieldAnnotationDraft = {
  helpText: string;
  previewUrl: string | null;
  pendingFile: File | null;
  removeImage: boolean;
};

function getEditableColumns(columns: ColumnListItem[]): ColumnListItem[] {
  return columns.filter(
    (column) =>
      column.isAdminEditable &&
      !column.isReadOnly &&
      !isGeneratedPrimaryCodeColumn(column),
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

function buildInitialAnnotations(
  editableColumns: ColumnListItem[],
  product?: ProductTableItem | null,
): Record<string, FieldAnnotationDraft> {
  const annotations: Record<string, FieldAnnotationDraft> = {};

  for (const column of editableColumns) {
    const existing = product?.fieldAnnotationsByColumnKey?.[column.internalKey];
    annotations[column.internalKey] = {
      helpText: existing?.helpText ?? "",
      previewUrl: existing?.thumbnailUrl ?? existing?.fullUrl ?? null,
      pendingFile: null,
      removeImage: false,
    };
  }

  return annotations;
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
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialValues(editableColumns, product),
  );
  const [annotations, setAnnotations] = useState<Record<string, FieldAnnotationDraft>>(() =>
    buildInitialAnnotations(editableColumns, product),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  function updateAnnotationHelpText(internalKey: string, helpText: string) {
    setAnnotations((current) => ({
      ...current,
      [internalKey]: {
        ...current[internalKey],
        helpText,
      },
    }));
  }

  function handleSelectImage(internalKey: string, file: File | null) {
    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAnnotations((current) => ({
      ...current,
      [internalKey]: {
        ...current[internalKey],
        pendingFile: file,
        previewUrl,
        removeImage: false,
      },
    }));
  }

  function handleRemoveImage(internalKey: string) {
    setAnnotations((current) => ({
      ...current,
      [internalKey]: {
        ...current[internalKey],
        pendingFile: null,
        previewUrl: null,
        removeImage: true,
      },
    }));
  }

  async function persistFieldImages(productId: string): Promise<string | null> {
    for (const column of editableColumns) {
      const draft = annotations[column.internalKey];
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
      payloadValues[column.internalKey] = raw.trim();
    }

    const fieldAnnotations: Record<
      string,
      { helpText: string | null; removeImage?: boolean }
    > = {};

    for (const column of editableColumns) {
      const draft = annotations[column.internalKey];
      if (!draft) {
        continue;
      }

      const helpText = draft.helpText.trim();
      const hasExistingImage = Boolean(
        product?.fieldAnnotationsByColumnKey?.[column.internalKey]?.thumbnailUrl ??
          product?.fieldAnnotationsByColumnKey?.[column.internalKey]?.fullUrl,
      );

      if (!helpText && !draft.pendingFile && !draft.removeImage && !hasExistingImage) {
        continue;
      }

      fieldAnnotations[column.internalKey] = {
        helpText: helpText || null,
        ...(draft.removeImage ? { removeImage: true } : {}),
      };
    }

    try {
      let productId = product?.id;

      if (isEditMode && productId) {
        const response = await fetch(`/api/admin/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            values: payloadValues,
            fieldAnnotations,
          }),
        });

        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok) {
          setError(payload?.error ?? "No se pudo actualizar el producto.");
          return;
        }
      } else {
        const response = await fetch(`/api/admin/folders/${folderId}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            values: payloadValues,
            fieldAnnotations,
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

      const imageError = await persistFieldImages(productId);
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
        className={`${styles.columnEditCard} ${styles.columnEditCardWide}`}
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
          <form className={styles.columnEditForm} onSubmit={(event) => void handleSubmit(event)}>
            {editableColumns.map((column) => {
              const draft = annotations[column.internalKey];

              return (
                <div key={column.id} className={styles.columnEditFieldGroup}>
                  <label className={styles.columnEditField}>
                    <span className={styles.columnEditLabel}>
                      {formatColumnTitleForDisplay(column.displayName)}
                      {column.isPrimaryCode ? " (código)" : null}
                      {column.isDescription ? " (descripción)" : null}
                      {column.isRequired ? null : (
                        <span className={styles.columnEditOptional}> (opcional)</span>
                      )}
                    </span>
                    <input
                      type="text"
                      className={styles.columnEditInput}
                      value={values[column.internalKey] ?? ""}
                      onChange={(event) =>
                        updateValue(column.internalKey, event.target.value)
                      }
                      disabled={isSaving}
                      required={column.isRequired}
                    />
                  </label>

                  <label className={styles.columnEditField}>
                    <span className={styles.columnEditLabel}>
                      Texto descriptivo
                      <span className={styles.columnEditOptional}> (opcional)</span>
                    </span>
                    <textarea
                      className={styles.columnEditTextarea}
                      value={draft?.helpText ?? ""}
                      onChange={(event) =>
                        updateAnnotationHelpText(column.internalKey, event.target.value)
                      }
                      disabled={isSaving}
                      maxLength={2000}
                      rows={2}
                      placeholder="Nota o aclaración para este campo"
                    />
                  </label>

                  <div className={styles.columnEditField}>
                    <span className={styles.columnEditLabel}>
                      Imagen de ayuda
                      <span className={styles.columnEditOptional}> (opcional)</span>
                    </span>
                    {draft?.previewUrl ? (
                      <div className={styles.columnEditImagePreview}>
                        <img
                          src={draft.previewUrl}
                          alt=""
                          className={styles.columnEditImagePreviewImg}
                        />
                        <div className={styles.columnEditImageActions}>
                          <button
                            type="button"
                            className={styles.columnEditImageReplace}
                            onClick={() => fileInputRefs.current[column.internalKey]?.click()}
                            disabled={isSaving}
                          >
                            Reemplazar
                          </button>
                          <button
                            type="button"
                            className={styles.columnEditImageRemove}
                            onClick={() => handleRemoveImage(column.internalKey)}
                            disabled={isSaving}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.columnEditDropzone}
                        onClick={() => fileInputRefs.current[column.internalKey]?.click()}
                        disabled={isSaving}
                      >
                        <Image
                          className={styles.columnEditDropzoneIcon}
                          strokeWidth={ICON_STROKE}
                          aria-hidden
                        />
                        <span className={styles.columnEditDropzoneTitle}>
                          Agregar imagen
                        </span>
                        <span className={styles.columnEditDropzoneHint}>
                          JPG, PNG o WebP
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
                </div>
              );
            })}

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
    </div>,
    document.body,
  );
}
