"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { FileSpreadsheet, ICON_STROKE, Search, X } from "@/shared/icons";
import catalogStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type ActionCardConfig = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  variant: "blue" | "green";
};

const ACTION_CARDS: ActionCardConfig[] = [
  {
    id: "import-excel",
    title: "Importar Excel",
    subtitle: "Subir nueva lista de precios o reemplazar la actual",
    icon: FileSpreadsheet,
    variant: "green",
  },
];

const SEARCH_DEBOUNCE_MS = 300;

type PricePageChromeProps = {
  onDebouncedSearchChange: (value: string) => void;
  searchDisabled?: boolean;
  onImportExcelClick?: () => void;
  supplierBanner?: ReactNode;
  children?: ReactNode;
};

function handleActionCardClick(
  cardId: string,
  handlers: Pick<PricePageChromeProps, "onImportExcelClick">,
): void {
  if (cardId === "import-excel") {
    handlers.onImportExcelClick?.();
  }
}

export function PricePageChrome({
  onDebouncedSearchChange,
  searchDisabled = false,
  onImportExcelClick,
  supplierBanner,
  children,
}: PricePageChromeProps) {
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onDebouncedSearchChange(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [onDebouncedSearchChange, searchInput]);

  const showActionCards = Boolean(onImportExcelClick);

  return (
    <section className={styles.sectionIntro} aria-label="Precios">
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Precios</h1>
        <div className={styles.headerSearchWrap}>
          <Search
            className={styles.headerSearchIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <input
            type="search"
            className={styles.headerSearch}
            placeholder="Buscar por código, descripción o columna indexada…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearchInput("");
              }
            }}
            disabled={searchDisabled}
            aria-label="Búsqueda en lista activa"
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

      {showActionCards || children ? (
        <div className={catalogStyles.catalogToolbar}>
          {showActionCards ? (
            <div className={styles.priceToolbarColumn}>
              <div
                className={`${catalogStyles.actionCards} ${styles.priceToolbarActionCards}`}
              >
                {ACTION_CARDS.map((card) => {
                  const Icon = card.icon;
                  const cardClassName =
                    card.variant === "green"
                      ? catalogStyles.actionCardGreen
                      : catalogStyles.actionCardBlue;
                  const iconClassName =
                    card.variant === "green"
                      ? catalogStyles.actionCardIconGreen
                      : catalogStyles.actionCardIconBlue;

                  const isDisabled = card.id === "import-excel" && !onImportExcelClick;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`${catalogStyles.actionCard} ${cardClassName} ${styles.priceToolbarActionCard}`}
                      aria-label={card.title}
                      data-testid={`price-action-${card.id}`}
                      disabled={isDisabled}
                      onClick={() =>
                        handleActionCardClick(card.id, {
                          onImportExcelClick,
                        })
                      }
                    >
                      <span className={`${catalogStyles.actionCardIcon} ${iconClassName}`}>
                        <Icon strokeWidth={ICON_STROKE} aria-hidden />
                      </span>
                      <span className={catalogStyles.actionCardText}>
                        <span className={catalogStyles.actionCardTitle}>{card.title}</span>
                        <span className={catalogStyles.actionCardSubtitle}>{card.subtitle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {supplierBanner}
            </div>
          ) : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}
