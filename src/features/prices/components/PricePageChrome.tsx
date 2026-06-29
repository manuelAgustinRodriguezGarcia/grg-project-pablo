"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FileSpreadsheet, ICON_STROKE, Plus, Search, X } from "@/shared/icons";
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
    id: "add-item",
    title: "Agregar ítem",
    subtitle: "Agregar ítem a la lista",
    icon: Plus,
    variant: "blue",
  },
  {
    id: "import-excel",
    title: "Importar Excel",
    subtitle: "Subir lista de precios",
    icon: FileSpreadsheet,
    variant: "green",
  },
];

type PricePageChromeProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  searchDisabled?: boolean;
  onImportExcelClick?: () => void;
  onAddItemClick?: () => void;
  children?: ReactNode;
};

function handleActionCardClick(
  cardId: string,
  handlers: Pick<PricePageChromeProps, "onImportExcelClick" | "onAddItemClick">,
): void {
  if (cardId === "import-excel") {
    handlers.onImportExcelClick?.();
    return;
  }

  if (cardId === "add-item") {
    handlers.onAddItemClick?.();
  }
}

export function PricePageChrome({
  searchQuery,
  onSearchChange,
  onSearchClear,
  searchDisabled = false,
  onImportExcelClick,
  onAddItemClick,
  children,
}: PricePageChromeProps) {
  const showActionCards = onImportExcelClick || onAddItemClick;

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
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onSearchClear();
              }
            }}
            disabled={searchDisabled}
            aria-label="Búsqueda en lista activa"
          />
          {searchQuery ? (
            <button
              type="button"
              className={styles.headerSearchClear}
              onClick={onSearchClear}
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
            <div className={catalogStyles.actionCards}>
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

                const isDisabled =
                  (card.id === "import-excel" && !onImportExcelClick) ||
                  (card.id === "add-item" && !onAddItemClick);

                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`${catalogStyles.actionCard} ${cardClassName}`}
                    aria-label={card.title}
                    data-testid={`price-action-${card.id}`}
                    disabled={isDisabled}
                    onClick={() =>
                      handleActionCardClick(card.id, {
                        onImportExcelClick,
                        onAddItemClick,
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
          ) : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}
