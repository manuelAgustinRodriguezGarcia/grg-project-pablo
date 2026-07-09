"use client";

import { memo, useMemo } from "react";
import type {
  CatalogSearchHit,
  FolderSearchHit,
  GlobalSearchResponse,
  SearchResultItem,
} from "@/features/catalog/types/global-search.types";
import {
  formatSearchMatchType,
  truncateMatchValue,
} from "@/features/catalog/utils/format-search-match-type";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

export type GlobalSearchDropdownOption =
  | {
      kind: "catalog";
      key: string;
      catalogId: string;
      label: string;
      description: string | null;
    }
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
      kind: "product";
      key: string;
      item: SearchResultItem;
    };

type CatalogGlobalSearchDropdownProps = {
  listboxId: string;
  data: GlobalSearchResponse | null;
  isLoading: boolean;
  error: string | null;
  minChars: number;
  queryLength: number;
  activeIndex: number;
  onSelectCatalog: (catalogId: string) => void;
  onSelectFolder: (catalogId: string, folderId: string) => void;
  onSelectProduct: (item: SearchResultItem) => void;
};

export function buildGlobalSearchDropdownOptions(
  data: GlobalSearchResponse | null,
): GlobalSearchDropdownOption[] {
  if (!data) {
    return [];
  }

  const catalogs: GlobalSearchDropdownOption[] = data.catalogs.map(
    (hit: CatalogSearchHit) => ({
      kind: "catalog" as const,
      key: `catalog:${hit.catalogId}`,
      catalogId: hit.catalogId,
      label: hit.name,
      description: hit.description,
    }),
  );

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

  const products: GlobalSearchDropdownOption[] = data.items.map((item) => ({
    kind: "product" as const,
    key: `product:${item.productId}`,
    item,
  }));

  return [...catalogs, ...folders, ...products];
}

function formatCellValue(value: string | null): string {
  if (!value?.trim()) {
    return "—";
  }

  return value.trim();
}

function activateOption(
  option: GlobalSearchDropdownOption,
  handlers: Pick<
    CatalogGlobalSearchDropdownProps,
    "onSelectCatalog" | "onSelectFolder" | "onSelectProduct"
  >,
): void {
  switch (option.kind) {
    case "catalog":
      handlers.onSelectCatalog(option.catalogId);
      return;
    case "folder":
      handlers.onSelectFolder(option.catalogId, option.folderId);
      return;
    case "product":
      handlers.onSelectProduct(option.item);
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
  onSelectCatalog,
  onSelectFolder,
  onSelectProduct,
}: CatalogGlobalSearchDropdownProps) {
  const options = useMemo(
    () => buildGlobalSearchDropdownOptions(data),
    [data],
  );
  const handlers = { onSelectCatalog, onSelectFolder, onSelectProduct };

  const catalogOptions = useMemo(
    () =>
      options
        .map((option, index): IndexedOption => ({ option, index }))
        .filter((entry) => entry.option.kind === "catalog"),
    [options],
  );
  const folderOptions = useMemo(
    () =>
      options
        .map((option, index): IndexedOption => ({ option, index }))
        .filter((entry) => entry.option.kind === "folder"),
    [options],
  );
  const productOptions = useMemo(
    () =>
      options
        .map((option, index): IndexedOption => ({ option, index }))
        .filter((entry) => entry.option.kind === "product"),
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

  if (isLoading && !data) {
    return (
      <div
        id={listboxId}
        className={styles.globalSearchDropdown}
        role="status"
        aria-busy="true"
      >
        <p className={styles.globalSearchDropdownHint}>Buscando coincidencias…</p>
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

    if (option.kind === "catalog") {
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
            <span className={styles.globalSearchDropdownOptionPrimary}>
              {option.label}
            </span>
            <span className={styles.globalSearchDropdownOptionMeta}>Catálogo</span>
          </button>
        </li>
      );
    }

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
            <span className={styles.globalSearchDropdownOptionPrimary}>
              {option.label}
            </span>
            <span className={styles.globalSearchDropdownOptionMeta}>
              {option.catalogName}
            </span>
          </button>
        </li>
      );
    }

    const thumbnailUrl =
      option.item.primaryImage?.thumbnailUrl ?? option.item.primaryImage?.fullUrl;
    const matchLabel = formatSearchMatchType(option.item.matchType);
    const matchValue = truncateMatchValue(option.item.matchValue, 48);

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
          <span className={styles.globalSearchDropdownThumbWrap} aria-hidden>
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt=""
                className={styles.globalSearchDropdownThumb}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className={styles.globalSearchDropdownThumbEmpty}>—</span>
            )}
          </span>
          <span className={styles.globalSearchDropdownProductBody}>
            <span className={styles.globalSearchDropdownOptionPrimary}>
              {formatCellValue(option.item.primaryCode)}
            </span>
            <span className={styles.globalSearchDropdownOptionSecondary}>
              {truncateMatchValue(formatCellValue(option.item.description), 72)}
            </span>
            <span className={styles.globalSearchDropdownOptionMeta}>
              {option.item.catalog.name} · {option.item.folder.name}
            </span>
            <span className={styles.globalSearchDropdownMatchRow}>
              <span className={styles.searchMatchBadge}>{matchLabel}</span>
              {matchValue ? (
                <span className={styles.globalSearchDropdownMatchValue}>
                  {matchValue}
                </span>
              ) : null}
            </span>
          </span>
        </button>
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
      {catalogOptions.length > 0 ? (
        <div className={styles.globalSearchDropdownSection}>
          <p className={styles.globalSearchDropdownHeading}>Catálogos</p>
          <ul className={styles.globalSearchDropdownList}>
            {catalogOptions.map(renderOption)}
          </ul>
        </div>
      ) : null}
      {folderOptions.length > 0 ? (
        <div className={styles.globalSearchDropdownSection}>
          <p className={styles.globalSearchDropdownHeading}>Secciones</p>
          <ul className={styles.globalSearchDropdownList}>
            {folderOptions.map(renderOption)}
          </ul>
        </div>
      ) : null}
      {productOptions.length > 0 ? (
        <div className={styles.globalSearchDropdownSection}>
          <p className={styles.globalSearchDropdownHeading}>Productos</p>
          <ul className={styles.globalSearchDropdownList}>
            {productOptions.map(renderOption)}
          </ul>
        </div>
      ) : null}
    </div>
  );
});
