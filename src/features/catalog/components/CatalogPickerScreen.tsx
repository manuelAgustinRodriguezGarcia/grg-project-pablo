"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
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

const PREVIEW_EXIT_MS = 180;
const PREVIEW_COLUMN_SIZE = 10;
const PREVIEW_COLUMN_MIN_WIDTH = 168;
const PREVIEW_ROW_HEIGHT = 28;
const PREVIEW_PAD_Y = 24;

function chunkNames(names: string[], size: number): string[][] {
  const columns: string[][] = [];
  for (let index = 0; index < names.length; index += size) {
    columns.push(names.slice(index, index + size));
  }
  return columns;
}

function CatalogFoldersPreview({
  anchor,
  names,
  active,
}: {
  anchor: HTMLElement | null;
  names: string[];
  active: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const columns = useMemo(
    () => chunkNames(names, PREVIEW_COLUMN_SIZE),
    [names],
  );
  const columnCount = Math.max(1, columns.length);
  const rowCount = Math.min(PREVIEW_COLUMN_SIZE, names.length);

  useEffect(() => {
    if (active && names.length > 0 && anchor) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timeout = window.setTimeout(() => setMounted(false), PREVIEW_EXIT_MS);
    return () => window.clearTimeout(timeout);
  }, [active, anchor, names.length]);

  useLayoutEffect(() => {
    if (!mounted || !anchor) {
      return;
    }

    function updatePosition() {
      if (!anchor) {
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const pad = 12;
      const width = Math.min(
        Math.max(rect.width, PREVIEW_COLUMN_MIN_WIDTH * columnCount),
        window.innerWidth - pad * 2,
      );
      const grid = anchor.closest("[role='listbox']");
      const gridRect = grid?.getBoundingClientRect();
      const edgeSlack = 10;
      const isLeftEdge = gridRect
        ? rect.left - gridRect.left <= edgeSlack
        : rect.left < window.innerWidth * 0.28;
      const isRightEdge = gridRect
        ? gridRect.right - rect.right <= edgeSlack
        : rect.right > window.innerWidth * 0.72;
      const cardCenter = rect.left + rect.width / 2;
      const viewportCenter = window.innerWidth / 2;
      const widePreview = columnCount > 1 || names.length > PREVIEW_COLUMN_SIZE;
      let left: number;
      if (isLeftEdge || (widePreview && cardCenter < viewportCenter)) {
        left = rect.left;
      } else if (isRightEdge || (widePreview && cardCenter > viewportCenter)) {
        left = rect.right - width;
      } else {
        left = cardCenter - width / 2;
      }
      left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));

      const gap = 8;
      const spaceBelow = window.innerHeight - rect.bottom - gap - pad;
      const spaceAbove = rect.top - gap - pad;
      const placeAbove = spaceBelow < 140 && spaceAbove > spaceBelow;
      const estimatedHeight = rowCount * PREVIEW_ROW_HEIGHT + PREVIEW_PAD_Y;
      const maxHeight = Math.max(
        96,
        Math.min(estimatedHeight, placeAbove ? spaceAbove : spaceBelow),
      );
      const top = placeAbove
        ? Math.max(pad, rect.top - gap - Math.min(estimatedHeight, maxHeight))
        : Math.min(
            rect.bottom + gap,
            window.innerHeight - maxHeight - pad,
          );

      setStyle({
        top,
        left,
        width,
        maxHeight,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor, columnCount, mounted, names.length, rowCount]);

  if (!mounted || names.length === 0 || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`${styles.pickerFoldersPreview}${
        visible ? ` ${styles.pickerFoldersPreviewVisible}` : ""
      }`}
      style={style}
      role="tooltip"
    >
      <div className={styles.pickerFoldersPreviewColumns}>
        {columns.map((column, columnIndex) => (
          <ul
            key={`preview-col-${columnIndex}`}
            className={styles.pickerFoldersPreviewList}
          >
            {column.map((name, rowIndex) => (
              <li
                key={`${columnIndex}-${name}`}
                className={`${styles.pickerFoldersPreviewItem}${
                  rowIndex % 2 === 0
                    ? ` ${styles.pickerFoldersPreviewItemEven}`
                    : ` ${styles.pickerFoldersPreviewItemOdd}`
                }`}
              >
                {name.toLocaleUpperCase("es")}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>,
    document.body,
  );
}

export function CatalogPickerScreen({
  catalogs,
  isAdmin = false,
  onSelectCatalog,
  onAddCatalog,
}: CatalogPickerScreenProps) {
  const [query, setQuery] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [cardFocusWithin, setCardFocusWithin] = useState(false);
  const [previewAnchor, setPreviewAnchor] = useState<HTMLElement | null>(null);
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

  const previewIndex =
    hoveredIndex !== null ? hoveredIndex : cardFocusWithin ? focusedIndex : null;
  const previewCatalog =
    previewIndex !== null ? filteredCatalogs[previewIndex] ?? null : null;
  const previewNames = previewCatalog?.sectionNames ?? [];
  const didInitFocusRef = useRef(false);

  useEffect(() => {
    if (filteredCatalogs.length === 0) {
      didInitFocusRef.current = false;
      searchInputRef.current?.focus();
      return;
    }

    if (didInitFocusRef.current) {
      return;
    }

    didInitFocusRef.current = true;
    focusCardAt(0);
  }, [filteredCatalogs.length, focusCardAt]);

  useLayoutEffect(() => {
    if (previewIndex === null) {
      setPreviewAnchor(null);
      return;
    }

    const card = gridRef.current?.querySelector<HTMLElement>(
      `[data-card-index="${previewIndex}"]`,
    );
    setPreviewAnchor(card ?? null);
  }, [focusedIndex, gridRef, hoveredIndex, previewIndex]);

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
            onFocusCapture={() => setCardFocusWithin(true)}
            onBlurCapture={(event) => {
              if (
                !event.currentTarget.contains(event.relatedTarget as Node | null)
              ) {
                setCardFocusWithin(false);
              }
            }}
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
                  onMouseEnter={() => {
                    setHoveredIndex(index);
                    focusCardAt(index);
                  }}
                  onMouseLeave={() => setHoveredIndex(null)}
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

      <CatalogFoldersPreview
        anchor={previewAnchor}
        names={previewNames}
        active={previewCatalog !== null && previewNames.length > 0}
      />

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
