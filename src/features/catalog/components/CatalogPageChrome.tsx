"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { FileSpreadsheet, ICON_STROKE, Plus, Search, X } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ActionCardConfig = {
  id: string;
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

type CatalogPageIntroProps = {
  onDebouncedSearchChange: (value: string) => void;
  searchResetKey?: number;
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
  onImportExcelClick,
  onAddProductClick,
  children,
}: CatalogPageIntroProps) {
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    setSearchInput("");
  }, [searchResetKey]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onDebouncedSearchChange(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [onDebouncedSearchChange, searchInput]);

  return (
    <section className={styles.sectionIntro} aria-label="Acciones de catálogos">
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Catálogos</h1>
        <div className={styles.headerSearchWrap}>
          <Search
            className={styles.headerSearchIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <input
            type="search"
            className={`${styles.headerSearch} ${searchInput ? styles.headerSearchWithClear : ""}`}
            placeholder="Búsqueda global en catálogos, secciones o registros…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearchInput("");
              }
            }}
            aria-label="Búsqueda global"
          />
          {searchInput ? (
            <button
              type="button"
              className={styles.headerSearchClear}
              onClick={() => setSearchInput("")}
              aria-label="Limpiar búsqueda"
            >
              <X strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.catalogToolbar}>
        <div className={styles.actionCards}>
          {ACTION_CARDS.map((card) => {
            const Icon = card.icon;
            const cardClassName =
              card.variant === "green"
                ? styles.actionCardGreen
                : styles.actionCardBlue;
            const iconClassName =
              card.variant === "green"
                ? styles.actionCardIconGreen
                : styles.actionCardIconBlue;

            const isDisabled =
              (card.id === "import-excel" && !onImportExcelClick) ||
              (card.id === "add-product" && !onAddProductClick);

            return (
              <button
                key={card.id}
                type="button"
                className={`${styles.actionCard} ${cardClassName}`}
                aria-label={card.title}
                data-testid={`catalog-action-${card.id}`}
                disabled={isDisabled}
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
        {children}
      </div>
    </section>
  );
}
