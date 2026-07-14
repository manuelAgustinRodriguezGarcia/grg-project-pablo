"use client";

import type { LucideIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  buildGlobalSearchDropdownOptions,
  CatalogGlobalSearchDropdown,
} from "@/features/catalog/components/CatalogGlobalSearchDropdown";
import { GlobalSearchProductFolderPreviewModal } from "@/features/catalog/components/GlobalSearchProductFolderPreviewModal";
import type {
  GlobalSearchResponse,
} from "@/features/catalog/types/global-search.types";
import type { ProductFolderSearchGroup } from "@/features/catalog/utils/group-search-results-by-folder";
import { FileSpreadsheet, ICON_STROKE, Plus, Search, X } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ActionCardId = "add-product" | "import-excel";

type ActionCardConfig = {
  id: ActionCardId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  variant: "blue" | "green";
};

const ACTION_CARDS: ActionCardConfig[] = [
  {
    id: "add-product",
    title: "Agregar producto",
    subtitle: "Agregar producto a catálogo",
    icon: Plus,
    variant: "blue",
  },
  {
    id: "import-excel",
    title: "Importar Excel",
    subtitle: "Subir lista de productos",
    icon: FileSpreadsheet,
    variant: "green",
  },
];

const SEARCH_DEBOUNCE_MS = 300;
const MIN_GLOBAL_SEARCH_CHARS = 2;

type CatalogPageIntroProps = {
  onDebouncedSearchChange: (value: string) => void;
  searchResetKey?: number;
  searchResults?: GlobalSearchResponse | null;
  isSearchLoading?: boolean;
  searchError?: string | null;
  onSelectSearchProductFolder?: (group: ProductFolderSearchGroup) => void;
  onSelectSearchFolder?: (catalogId: string, folderId: string) => void;
  onImportExcelClick?: () => void;
  onAddProductClick?: () => void;
  children?: ReactNode;
};

function handleActionCardClick(
  cardId: string,
  handlers: Pick<CatalogPageIntroProps, "onImportExcelClick" | "onAddProductClick">,
): void {
  if (cardId === "import-excel") {
    handlers.onImportExcelClick?.();
    return;
  }

  if (cardId === "add-product") {
    handlers.onAddProductClick?.();
  }
}

export function CatalogPageIntro({
  onDebouncedSearchChange,
  searchResetKey = 0,
  searchResults = null,
  isSearchLoading = false,
  searchError = null,
  onSelectSearchProductFolder,
  onSelectSearchFolder,
  onImportExcelClick,
  onAddProductClick,
  children,
}: CatalogPageIntroProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [previewGroup, setPreviewGroup] = useState<ProductFolderSearchGroup | null>(
    null,
  );

  useEffect(() => {
    setSearchInput("");
    setDebouncedQuery("");
    setActiveIndex(-1);
  }, [searchResetKey]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextQuery = searchInput.trim();
      setDebouncedQuery(nextQuery);
      onDebouncedSearchChange(nextQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [onDebouncedSearchChange, searchInput]);

  const trimmedInput = searchInput.trim();
  const canQuery = debouncedQuery.length >= MIN_GLOBAL_SEARCH_CHARS;
  const isSearchPending =
    trimmedInput.length >= MIN_GLOBAL_SEARCH_CHARS &&
    (trimmedInput !== debouncedQuery || isSearchLoading);
  const options = useMemo(
    () =>
      isSearchPending
        ? []
        : buildGlobalSearchDropdownOptions(searchResults),
    [isSearchPending, searchResults],
  );
  const showDropdown =
    isFocused &&
    trimmedInput.length > 0 &&
    (trimmedInput.length < MIN_GLOBAL_SEARCH_CHARS ||
      canQuery ||
      isSearchPending ||
      Boolean(searchError) ||
      isSearchLoading);

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery, isSearchPending, searchResults]);

  useEffect(() => {
    if (!showDropdown || previewGroup) {
      return;
    }

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [previewGroup, showDropdown]);

  const activateActiveOption = () => {
    if (activeIndex < 0 || activeIndex >= options.length) {
      return;
    }

    const option = options[activeIndex];
    switch (option.kind) {
      case "folder":
        onSelectSearchFolder?.(option.catalogId, option.folderId);
        return;
      case "productFolder":
        onSelectSearchProductFolder?.(option.group);
        return;
      default: {
        const exhaustive: never = option;
        return exhaustive;
      }
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (showDropdown) {
        event.preventDefault();
        setIsFocused(false);
        setActiveIndex(-1);
        return;
      }

      setSearchInput("");
      return;
    }

    if (!showDropdown || options.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current < options.length - 1 ? current + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? options.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      if (activeIndex >= 0) {
        event.preventDefault();
        activateActiveOption();
      }
    }
  };

  const activeOptionId =
    showDropdown && activeIndex >= 0
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  const visibleActionCards = ACTION_CARDS.filter((card) => {
    switch (card.id) {
      case "import-excel":
        return Boolean(onImportExcelClick);
      case "add-product":
        return Boolean(onAddProductClick);
      default: {
        const exhaustive: never = card.id;
        return exhaustive;
      }
    }
  });

  return (
    <section className={styles.sectionIntro} aria-label="Acciones de catálogos">
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Catálogos</h1>
        <div ref={rootRef} className={styles.headerSearchWrap}>
          <Search
            className={styles.headerSearchIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <input
            type="search"
            className={`${styles.headerSearch} ${searchInput ? styles.headerSearchWithClear : ""}`}
            placeholder="Búsqueda global en carpetas o productos…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleSearchKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-label="Búsqueda global"
          />
          {searchInput ? (
            <button
              type="button"
              className={styles.headerSearchClear}
              onClick={() => {
                setSearchInput("");
                setActiveIndex(-1);
              }}
              aria-label="Limpiar búsqueda"
            >
              <X strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          ) : null}
          {showDropdown ? (
            <CatalogGlobalSearchDropdown
              listboxId={listboxId}
              data={canQuery && !isSearchPending ? searchResults : null}
              isLoading={isSearchPending}
              error={canQuery && !isSearchPending ? searchError : null}
              minChars={MIN_GLOBAL_SEARCH_CHARS}
              queryLength={trimmedInput.length}
              activeIndex={activeIndex}
              onSelectFolder={(catalogId, folderId) =>
                onSelectSearchFolder?.(catalogId, folderId)
              }
              onSelectProductFolder={(group) =>
                onSelectSearchProductFolder?.(group)
              }
              onPreviewProductFolder={setPreviewGroup}
            />
          ) : null}
        </div>
      </div>

      <div className={styles.catalogToolbar}>
        {visibleActionCards.length > 0 ? (
          <div className={styles.actionCards}>
            {visibleActionCards.map((card) => {
              const Icon = card.icon;
              const cardClassName =
                card.variant === "green"
                  ? styles.actionCardGreen
                  : styles.actionCardBlue;
              const iconClassName =
                card.variant === "green"
                  ? styles.actionCardIconGreen
                  : styles.actionCardIconBlue;

              return (
                <button
                  key={card.id}
                  type="button"
                  className={`${styles.actionCard} ${cardClassName}`}
                  aria-label={card.title}
                  data-testid={`catalog-action-${card.id}`}
                  onClick={() =>
                    handleActionCardClick(card.id, {
                      onImportExcelClick,
                      onAddProductClick,
                    })
                  }
                >
                  <span className={`${styles.actionCardIcon} ${iconClassName}`}>
                    <Icon strokeWidth={ICON_STROKE} aria-hidden />
                  </span>
                  <span className={styles.actionCardText}>
                    <span className={styles.actionCardTitle}>{card.title}</span>
                    <span className={styles.actionCardSubtitle}>{card.subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {children}
      </div>
      {previewGroup ? (
        <GlobalSearchProductFolderPreviewModal
          group={previewGroup}
          onClose={() => setPreviewGroup(null)}
          onNavigate={() => {
            onSelectSearchProductFolder?.(previewGroup);
            setPreviewGroup(null);
          }}
        />
      ) : null}
    </section>
  );
}
