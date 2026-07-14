"use client";

import { memo, useMemo } from "react";
import type {
  FolderSearchHit,
  GlobalSearchResponse,
} from "@/features/catalog/types/global-search.types";
import {
  formatProductFolderResultCount,
  formatProductFolderResultLabel,
  groupSearchResultsByFolder,
  type ProductFolderSearchGroup,
} from "@/features/catalog/utils/group-search-results-by-folder";
import { Eye, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

export type GlobalSearchDropdownOption =
  | {
      kind: "folder";
      key: string;
      catalogId: string;
      folderId: string;
      label: string;
      description: string | null;
      catalogName: string;
    }
  | {
      kind: "productFolder";
      key: string;
      group: ProductFolderSearchGroup;
      label: string;
    };

type CatalogGlobalSearchDropdownProps = {
  listboxId: string;
  data: GlobalSearchResponse | null;
  isLoading: boolean;
  error: string | null;
  minChars: number;
  queryLength: number;
  activeIndex: number;
  onSelectFolder: (catalogId: string, folderId: string) => void;
  onSelectProductFolder: (group: ProductFolderSearchGroup) => void;
  onPreviewProductFolder: (group: ProductFolderSearchGroup) => void;
};

export function buildGlobalSearchDropdownOptions(
  data: GlobalSearchResponse | null,
): GlobalSearchDropdownOption[] {
  if (!data) {
    return [];
  }

  const folders: GlobalSearchDropdownOption[] = data.folders.map(
    (hit: FolderSearchHit) => ({
      kind: "folder" as const,
      key: `folder:${hit.folderId}`,
      catalogId: hit.catalog.id,
      folderId: hit.folderId,
      label: hit.name,
      description: hit.description,
      catalogName: hit.catalog.name,
    }),
  );

  const productFolders: GlobalSearchDropdownOption[] =
    groupSearchResultsByFolder(data.items).map((group) => ({
      kind: "productFolder" as const,
      key: `product-folder:${group.folderId}`,
      group,
      label: formatProductFolderResultLabel(
        group.items.length,
        group.folderName,
        group.catalogName,
      ),
    }));

  return [...folders, ...productFolders];
}

function activateOption(
  option: GlobalSearchDropdownOption,
  handlers: Pick<
    CatalogGlobalSearchDropdownProps,
    "onSelectFolder" | "onSelectProductFolder"
  >,
): void {
  switch (option.kind) {
    case "folder":
      handlers.onSelectFolder(option.catalogId, option.folderId);
      return;
    case "productFolder":
      handlers.onSelectProductFolder(option.group);
      return;
    default: {
      const exhaustive: never = option;
      return exhaustive;
    }
  }
}

type IndexedOption = {
  option: GlobalSearchDropdownOption;
  index: number;
};

export const CatalogGlobalSearchDropdown = memo(function CatalogGlobalSearchDropdown({
  listboxId,
  data,
  isLoading,
  error,
  minChars,
  queryLength,
  activeIndex,
  onSelectFolder,
  onSelectProductFolder,
  onPreviewProductFolder,
}: CatalogGlobalSearchDropdownProps) {
  const options = useMemo(
    () => buildGlobalSearchDropdownOptions(data),
    [data],
  );
  const handlers = { onSelectFolder, onSelectProductFolder };

  const folderOptions = useMemo(
    () =>
      options
        .map((option, index): IndexedOption => ({ option, index }))
        .filter((entry) => entry.option.kind === "folder"),
    [options],
  );
  const productFolderOptions = useMemo(
    () =>
      options
        .map((option, index): IndexedOption => ({ option, index }))
        .filter((entry) => entry.option.kind === "productFolder"),
    [options],
  );

  if (queryLength > 0 && queryLength < minChars) {
    return (
      <div
        id={listboxId}
        className={styles.globalSearchDropdown}
        role="status"
      >
        <p className={styles.globalSearchDropdownHint}>
          Escribí al menos {minChars} caracteres para buscar.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        id={listboxId}
        className={styles.globalSearchDropdown}
        role="alert"
      >
        <p className={styles.globalSearchDropdownHint}>{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        id={listboxId}
        className={styles.globalSearchDropdown}
        role="status"
        aria-busy="true"
        aria-label="Buscando coincidencias"
      >
        <div className={styles.globalSearchDropdownLoading}>
          <span className={styles.globalSearchDropdownSpinner} aria-hidden />
          <p className={styles.globalSearchDropdownHint}>Buscando coincidencias…</p>
        </div>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div
        id={listboxId}
        className={styles.globalSearchDropdown}
        role="status"
      >
        <p className={styles.globalSearchDropdownHint}>Sin coincidencias.</p>
      </div>
    );
  }

  const renderOption = ({ option, index }: IndexedOption) => {
    const isActive = index === activeIndex;
    const optionId = `${listboxId}-option-${index}`;
    const optionClassName = `${styles.globalSearchDropdownOption} ${
      isActive ? styles.globalSearchDropdownOptionActive : ""
    }`;

    if (option.kind === "folder") {
      return (
        <li
          key={option.key}
          id={optionId}
          role="option"
          aria-selected={isActive}
          className={optionClassName}
        >
          <button
            type="button"
            className={styles.globalSearchDropdownOptionButton}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => activateOption(option, handlers)}
          >
            <span className={styles.globalSearchDropdownFolderLabel}>
              <span className={styles.globalSearchDropdownOptionPrimary}>
                {option.label}
              </span>
              <span className={styles.globalSearchDropdownOptionMeta}>
                | Catálogo: {option.catalogName}
              </span>
            </span>
          </button>
        </li>
      );
    }

    return (
      <li
        key={option.key}
        id={optionId}
        role="option"
        aria-selected={isActive}
        className={optionClassName}
      >
        <div className={styles.globalSearchProductFolderCard}>
          <button
            type="button"
            className={styles.globalSearchDropdownOptionButton}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => activateOption(option, handlers)}
          >
            <span className={styles.globalSearchProductFolderBody}>
              <span className={styles.globalSearchDropdownOptionPrimary}>
                {formatProductFolderResultCount(
                  option.group.items.length,
                  option.group.folderName,
                )}
              </span>
              <span className={styles.globalSearchProductFolderCatalog}>
                Catálogo: {option.group.catalogName}
              </span>
            </span>
          </button>
          <span className={styles.rowActionWrap}>
            <button
              type="button"
              className={styles.globalSearchPreviewButton}
              aria-label="Vista previa"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                onPreviewProductFolder(option.group);
              }}
            >
              <Eye strokeWidth={ICON_STROKE} aria-hidden />
              <span>Vista previa</span>
            </button>
          </span>
        </div>
      </li>
    );
  };

  return (
    <div
      id={listboxId}
      className={styles.globalSearchDropdown}
      role="listbox"
      aria-label="Coincidencias de búsqueda global"
    >
      {folderOptions.length > 0 ? (
        <div className={styles.globalSearchDropdownSection}>
          <p className={styles.globalSearchDropdownHeading}>Carpetas</p>
          <ul className={styles.globalSearchDropdownList}>
            {folderOptions.map(renderOption)}
          </ul>
        </div>
      ) : null}
      {productFolderOptions.length > 0 ? (
        <div className={styles.globalSearchDropdownSection}>
          <p className={styles.globalSearchDropdownHeading}>Productos</p>
          <ul className={styles.globalSearchDropdownList}>
            {productFolderOptions.map(renderOption)}
          </ul>
        </div>
      ) : null}
    </div>
  );
});
