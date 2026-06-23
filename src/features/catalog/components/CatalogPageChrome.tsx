"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FileSpreadsheet, ICON_STROKE, Plus, Search } from "@/shared/icons";
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

type CatalogPageIntroProps = {
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
  onImportExcelClick,
  onAddProductClick,
  children,
}: CatalogPageIntroProps) {
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
            className={styles.headerSearch}
            placeholder="Búsqueda global en catálogos, secciones o registros…"
            readOnly
            aria-label="Búsqueda global"
          />
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
        {children}
      </div>
    </section>
  );
}
