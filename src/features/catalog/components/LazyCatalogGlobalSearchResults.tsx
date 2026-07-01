"use client";

import dynamic from "next/dynamic";
import { AdminTableSkeleton } from "@/features/admin/components/AdminTableSkeleton";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

function CatalogGlobalSearchResultsLoading() {
  return (
    <section className={styles.tablePanel} aria-label="Resultados de búsqueda global" aria-busy="true">
      <AdminTableSkeleton variant="catalog" label="Cargando resultados de búsqueda" />
    </section>
  );
}

export const LazyCatalogGlobalSearchResults = dynamic(
  () =>
    import("@/features/catalog/components/CatalogGlobalSearchResults").then((module) => ({
      default: module.CatalogGlobalSearchResults,
    })),
  {
    ssr: false,
    loading: CatalogGlobalSearchResultsLoading,
  },
);
