"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCardGridKeyboard } from "@/features/catalog/hooks/useCardGridKeyboard";
import type { CatalogNavigationFolderItem } from "@/features/catalog/types/navigation.types";
import { CATALOG_COVER_FALLBACK_SRC } from "@/features/catalog/utils/catalog-cover";
import { sortByName } from "@/features/catalog/utils/sortByName";
import {
  ArrowLeft,
  ICON_STROKE,
  Pencil,
  Plus,
  Search,
  TableProperties,
  Trash2,
} from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type FolderPickerScreenProps = {
  catalogName: string;
  folders: CatalogNavigationFolderItem[];
  isLoading: boolean;
  expectedFolderCount?: number;
  isAdmin?: boolean;
  onBack: () => void;
  onSelectFolder: (folderId: string) => void;
  onEditFolder?: (folderId: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onAddFolder?: () => void;
  onEditFolderCover?: (folderId: string) => void;
};

export function FolderPickerScreen({
  catalogName,
  folders,
  isLoading,
  expectedFolderCount = 0,
  isAdmin = false,
  onBack,
  onSelectFolder,
  onEditFolder,
  onDeleteFolder,
  onAddFolder,
  onEditFolderCover,
}: FolderPickerScreenProps) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const showFab = Boolean(isAdmin && onAddFolder);
  const skeletonCount = expectedFolderCount > 0 ? expectedFolderCount : 8;

  const filteredFolders = useMemo(() => {
    const sorted = sortByName(folders);
    const trimmed = query.trim().toLocaleLowerCase("es");
    if (!trimmed) {
      return sorted;
    }
    return sorted.filter((folder) =>
      folder.name.toLocaleLowerCase("es").includes(trimmed),
    );
  }, [folders, query]);

  const {
    gridRef,
    focusedIndex,
    focusCardAt,
    handleSearchKeyDown,
    handleCardKeyDown,
  } = useCardGridKeyboard({
    itemCount: filteredFolders.length,
    enabled: !isLoading,
    searchInputRef,
    onActivate: (index) => {
      const folder = filteredFolders[index];
      if (folder) {
        onSelectFolder(folder.id);
      }
    },
  });

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  return (
    <section
      className={`${styles.pickerScreen}${showFab ? ` ${styles.pickerScreenWithFab}` : ""}`}
      aria-label="Carpetas del catálogo"
    >
      <div className={styles.pickerContent}>
        <header className={styles.pickerHeader}>
          <div className={styles.pickerHeaderTop}>
            <h1 className={styles.pickerPageTitle}>
              <TableProperties
                className={styles.pickerPageTitleIcon}
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
              Catálogos
            </h1>
            <button
              type="button"
              className={styles.pickerBackButton}
              onClick={onBack}
            >
              <ArrowLeft strokeWidth={ICON_STROKE} aria-hidden />
              Volver a catálogos
            </button>
          </div>
          <div className={styles.pickerHeaderToolbar}>
            <h2 className={styles.pickerFolderCatalogName}>{catalogName}</h2>
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
                placeholder="Buscar carpeta por nombre"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                aria-label="Buscar carpeta por nombre"
              />
            </div>
          </div>
        </header>

        {isLoading ? (
          <div
            className={styles.pickerGridFolders}
            role="status"
            aria-live="polite"
            aria-label="Cargando carpetas"
          >
            {Array.from({ length: skeletonCount }, (_, index) => (
              <div
                key={`folder-skeleton-${index}`}
                className={`${styles.pickerCard} ${styles.pickerCardHorizontal} ${styles.pickerCardSkeleton}`}
                aria-hidden
              >
                <span
                  className={`${styles.pickerShimmerBlock} ${styles.pickerShimmerThumb}`}
                />
                <span className={styles.pickerShimmerBody}>
                  <span
                    className={`${styles.pickerShimmerBlock} ${styles.pickerShimmerTitle}`}
                  />
                  <span
                    className={`${styles.pickerShimmerBlock} ${styles.pickerShimmerMeta}`}
                  />
                </span>
              </div>
            ))}
          </div>
        ) : filteredFolders.length === 0 ? (
          <p className={styles.pickerEmpty}>
            {folders.length === 0
              ? "Este catálogo no tiene carpetas."
              : "No se encontraron carpetas con ese nombre."}
          </p>
        ) : (
          <div
            ref={gridRef}
            className={styles.pickerGridFolders}
            role="listbox"
            aria-label="Carpetas"
          >
            {filteredFolders.map((folder, index) => {
              const imageSrc = folder.coverImageUrl || CATALOG_COVER_FALLBACK_SRC;
              const productLabel =
                folder.productCount === 1
                  ? "1 producto"
                  : `${folder.productCount} productos`;

              return (
                <div
                  key={folder.id}
                  role="option"
                  aria-selected={focusedIndex === index}
                  data-card-index={index}
                  className={`${styles.pickerCard} ${styles.pickerCardHorizontal}${
                    focusedIndex === index ? ` ${styles.pickerCardFocused}` : ""
                  }`}
                  tabIndex={focusedIndex === index ? 0 : -1}
                  onClick={() => onSelectFolder(folder.id)}
                  onFocus={() => {
                    if (focusedIndex !== index) {
                      focusCardAt(index);
                    }
                  }}
                  onKeyDown={(event) => handleCardKeyDown(event, index)}
                >
                  <span className={styles.pickerCardImageWrap}>
                    <img
                      src={imageSrc}
                      alt=""
                      className={
                        folder.coverImageUrl
                          ? styles.pickerCardImage
                          : styles.pickerCardImageFallback
                      }
                    />
                    {isAdmin && onEditFolderCover ? (
                      <button
                        type="button"
                        className={styles.pickerCardImageEdit}
                        aria-label={`Cambiar imagen de ${folder.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditFolderCover(folder.id);
                        }}
                      >
                        <Pencil strokeWidth={ICON_STROKE} aria-hidden />
                      </button>
                    ) : null}
                  </span>
                  <span className={styles.pickerCardBody}>
                    <span className={styles.pickerCardTitle}>{folder.name}</span>
                    <span className={styles.pickerCardMeta}>{productLabel}</span>
                  </span>
                  {isAdmin && (onEditFolder || onDeleteFolder) ? (
                    <span className={styles.pickerCardActions}>
                      {onEditFolder ? (
                        <button
                          type="button"
                          className={styles.pickerCardAction}
                          aria-label={`Editar ${folder.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditFolder(folder.id);
                          }}
                        >
                          <Pencil strokeWidth={ICON_STROKE} aria-hidden />
                        </button>
                      ) : null}
                      {onDeleteFolder ? (
                        <button
                          type="button"
                          className={`${styles.pickerCardAction} ${styles.pickerCardActionDanger}`}
                          aria-label={`Eliminar ${folder.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteFolder(folder.id);
                          }}
                        >
                          <Trash2 strokeWidth={ICON_STROKE} aria-hidden />
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </div>
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
            onClick={onAddFolder}
          >
            <Plus strokeWidth={ICON_STROKE} aria-hidden />
            Nueva carpeta
          </button>
        </div>
      ) : null}
    </section>
  );
}
