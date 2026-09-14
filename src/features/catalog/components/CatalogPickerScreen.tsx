"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCardGridKeyboard } from "@/features/catalog/hooks/useCardGridKeyboard";
import type { DirectoryCatalogItem } from "@/features/directory/types/directory.types";
import { sortByName } from "@/features/catalog/utils/sortByName";
import { ICON_STROKE, Plus, Search, TableProperties } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type CatalogPickerScreenProps = {
  catalogs: DirectoryCatalogItem[];
  isAdmin?: boolean;
  onSelectCatalog: (catalogId: string) => void;
  onAddCatalog?: () => void;
};

export function CatalogPickerScreen({
  catalogs,
  isAdmin = false,
  onSelectCatalog,
  onAddCatalog,
}: CatalogPickerScreenProps) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const showFab = Boolean(isAdmin && onAddCatalog);

  const filteredCatalogs = useMemo(() => {
    const sorted = sortByName(catalogs);
    const trimmed = query.trim().toLocaleLowerCase("es");
    if (!trimmed) {
      return sorted;
    }
    return sorted.filter((catalog) =>
      catalog.name.toLocaleLowerCase("es").includes(trimmed),
    );
  }, [catalogs, query]);

  const {
    gridRef,
    focusedIndex,
    focusCardAt,
    handleSearchKeyDown,
    handleCardKeyDown,
  } = useCardGridKeyboard({
    itemCount: filteredCatalogs.length,
    searchInputRef,
    onActivate: (index) => {
      const catalog = filteredCatalogs[index];
      if (catalog) {
        onSelectCatalog(catalog.id);
      }
    },
  });

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  return (
    <section
      className={`${styles.pickerScreen}${showFab ? ` ${styles.pickerScreenWithFab}` : ""}`}
      aria-label="Catálogos"
    >
      <div className={styles.pickerContent}>
        <header className={styles.pickerHeader}>
          <div className={styles.pickerHeaderToolbar}>
            <h1 className={styles.pickerPageTitle}>
              <TableProperties
                className={styles.pickerPageTitleIcon}
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
              Catálogos
            </h1>
            <div className={styles.pickerSearchWrap}>
              <Search
                className={styles.pickerSearchIcon}
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
              <input
                ref={searchInputRef}
                type="search"
                className={styles.pickerSearchInput}
                placeholder="Buscar por nombre"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                aria-label="Buscar catálogo por nombre"
              />
            </div>
          </div>
        </header>

        {filteredCatalogs.length === 0 ? (
          <p className={styles.pickerEmpty}>
            {catalogs.length === 0
              ? "No hay catálogos disponibles."
              : "No se encontraron catálogos con ese nombre."}
          </p>
        ) : (
          <div
            ref={gridRef}
            className={styles.pickerGrid}
            role="listbox"
            aria-label="Catálogos"
          >
            {filteredCatalogs.map((catalog, index) => {
              const sectionLabel =
                catalog.sectionCount === 1
                  ? "1 carpeta"
                  : `${catalog.sectionCount} carpetas`;

              return (
                <button
                  key={catalog.id}
                  type="button"
                  role="option"
                  aria-selected={focusedIndex === index}
                  data-card-index={index}
                  className={`${styles.pickerCard}${
                    focusedIndex === index ? ` ${styles.pickerCardFocused}` : ""
                  }`}
                  tabIndex={focusedIndex === index ? 0 : -1}
                  onClick={() => onSelectCatalog(catalog.id)}
                  onFocus={() => {
                    if (focusedIndex !== index) {
                      focusCardAt(index);
                    }
                  }}
                  onKeyDown={(event) => handleCardKeyDown(event, index)}
                >
                  {catalog.coverImageUrl ? (
                    <span className={styles.pickerCardImageWrap}>
                      <img
                        src={catalog.coverImageUrl}
                        alt=""
                        className={styles.pickerCardImage}
                      />
                    </span>
                  ) : null}
                  <span className={styles.pickerCardBody}>
                    <span className={styles.pickerCardTitle}>{catalog.name}</span>
                    <span className={styles.pickerCardMeta}>{sectionLabel}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showFab ? (
        <div className={styles.pickerFab}>
          <button
            type="button"
            className={styles.pickerAddButton}
            onClick={onAddCatalog}
          >
            <Plus strokeWidth={ICON_STROKE} aria-hidden />
            Nuevo catálogo
          </button>
        </div>
      ) : null}
    </section>
  );
}
