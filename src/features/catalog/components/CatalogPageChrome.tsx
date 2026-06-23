"use client";

import type { LucideIcon } from "lucide-react";
import { FileSpreadsheet, ICON_STROKE, Plus, Search } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ActionCardConfig = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconVariant: "green" | "excel";
};

const ACTION_CARDS: ActionCardConfig[] = [
  {
    id: "add-product",
    title: "Agregar producto",
    subtitle: "Agregar producto a catálogo",
    icon: Plus,
    iconVariant: "green",
  },
  {
    id: "import-excel",
    title: "Importar Excel",
    subtitle: "Subir archivo y actualizar productos",
    icon: FileSpreadsheet,
    iconVariant: "excel",
  },
];

export function CatalogPageTopBar() {
  return (
    <header className={styles.topBar}>
      <div className={styles.headerSearchWrap}>
        <Search className={styles.headerSearchIcon} strokeWidth={ICON_STROKE} aria-hidden />
        <input
          type="search"
          className={styles.headerSearch}
          placeholder="Búsqueda global en catálogos, secciones o registros…"
          readOnly
          aria-label="Búsqueda global"
        />
      </div>
    </header>
  );
}

export function CatalogPageIntro() {
  return (
    <section className={styles.sectionIntro} aria-label="Acciones de catálogos">
      <h1 className={styles.sectionTitle}>Catálogos</h1>

      <div className={styles.actionCards}>
        {ACTION_CARDS.map((card) => {
          const Icon = card.icon;
          const iconClassName =
            card.iconVariant === "excel"
              ? styles.actionCardIconExcel
              : styles.actionCardIconGreen;

          return (
            <button
              key={card.id}
              type="button"
              className={styles.actionCard}
              aria-label={card.title}
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
    </section>
  );
}
