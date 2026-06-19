"use client";

import { useMemo, useState } from "react";
import { CatalogFolderSelectors } from "@/features/catalog/components/CatalogFolderSelectors";
import { CatalogSelectionSummary } from "@/features/catalog/components/CatalogSelectionSummary";
import type { MockCatalog } from "@/features/catalog/types/catalog-navigator.types";
import { sortByName } from "@/features/catalog/utils/sortByName";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type CatalogNavigatorProps = {
  catalogs: MockCatalog[];
};

function getInitialSelection(catalogs: MockCatalog[]) {
  const sortedCatalogs = sortByName(catalogs);
  const firstCatalog = sortedCatalogs[0];

  if (!firstCatalog) {
    return { catalogId: "", folderId: "" };
  }

  const firstFolder = sortByName(firstCatalog.folders)[0];

  return {
    catalogId: firstCatalog.id,
    folderId: firstFolder?.id ?? "",
  };
}

export function CatalogNavigator({ catalogs }: CatalogNavigatorProps) {
  const initialSelection = useMemo(() => getInitialSelection(catalogs), [catalogs]);
  const [selectedCatalogId, setSelectedCatalogId] = useState(initialSelection.catalogId);
  const [selectedFolderId, setSelectedFolderId] = useState(initialSelection.folderId);

  const sortedCatalogs = useMemo(() => sortByName(catalogs), [catalogs]);

  const selectedCatalog = useMemo(
    () => sortedCatalogs.find((catalog) => catalog.id === selectedCatalogId) ?? null,
    [sortedCatalogs, selectedCatalogId],
  );

  const sortedFolders = useMemo(
    () => sortByName(selectedCatalog?.folders ?? []),
    [selectedCatalog],
  );

  const selectedFolder = useMemo(
    () => sortedFolders.find((folder) => folder.id === selectedFolderId) ?? null,
    [sortedFolders, selectedFolderId],
  );

  function handleSelectCatalog(catalogId: string) {
    const catalog = sortedCatalogs.find((item) => item.id === catalogId);
    const firstFolder = sortByName(catalog?.folders ?? [])[0];

    setSelectedCatalogId(catalogId);
    setSelectedFolderId(firstFolder?.id ?? "");
  }

  function handleSelectFolder(folderId: string) {
    setSelectedFolderId(folderId);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Catálogos</h1>
        <p className={styles.subtitle}>
          Seleccioná un catálogo y una carpeta para preparar la consulta de productos.
        </p>
      </header>

      <div className={styles.grid}>
        <CatalogFolderSelectors
          catalogs={catalogs}
          selectedCatalogId={selectedCatalogId}
          selectedFolderId={selectedFolderId}
          onSelectCatalog={handleSelectCatalog}
          onSelectFolder={handleSelectFolder}
        />

        <CatalogSelectionSummary catalog={selectedCatalog} folder={selectedFolder} />
      </div>
    </div>
  );
}
