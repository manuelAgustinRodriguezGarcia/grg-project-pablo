"use client";

import { Search, X, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/files/styles/FilesManager.module.scss";

type FilesPageIntroProps = {
  query: string;
  onQueryChange: (value: string) => void;
};

export function FilesPageIntro({ query, onQueryChange }: FilesPageIntroProps) {
  return (
    <section className={styles.sectionIntro} aria-label="Archivos subidos">
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Archivos</h1>
        <div className={styles.headerSearchWrap}>
          <Search
            className={styles.headerSearchIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <input
            type="search"
            className={`${styles.headerSearch} ${query ? styles.headerSearchWithClear : ""}`}
            placeholder="Buscar por nombre de archivo…"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label="Buscar archivos por nombre"
          />
          {query ? (
            <button
              type="button"
              className={styles.headerSearchClear}
              onClick={() => onQueryChange("")}
              aria-label="Limpiar búsqueda"
            >
              <X strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
