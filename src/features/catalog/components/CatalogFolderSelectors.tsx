"use client";

import { useMemo } from "react";
import { CustomDropdown } from "@/features/catalog/components/CustomDropdown";
import type {
  MockCatalog,
  MockFolder,
} from "@/features/catalog/types/catalog-navigator.types";
import { sortByName } from "@/features/catalog/utils/sortByName";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type CatalogFolderSelectorsProps = {
  catalogs: MockCatalog[];
  selectedCatalogId: string;
  selectedFolderId: string;
  onSelectCatalog: (catalogId: string) => void;
  onSelectFolder: (folderId: string) => void;
};

export function CatalogFolderSelectors({
  catalogs,
  selectedCatalogId,
  selectedFolderId,
  onSelectCatalog,
  onSelectFolder,
}: CatalogFolderSelectorsProps) {
  const sortedCatalogs = useMemo(() => sortByName(catalogs), [catalogs]);

  const selectedCatalog = useMemo(
    () => sortedCatalogs.find((catalog) => catalog.id === selectedCatalogId) ?? null,
    [sortedCatalogs, selectedCatalogId],
  );

  const sortedFolders = useMemo(
    () => sortByName(selectedCatalog?.folders ?? []),
    [selectedCatalog],
  );

  const catalogOptions = useMemo(
    () =>
      sortedCatalogs.map((catalog) => ({
        id: catalog.id,
        label: catalog.name,
        description: catalog.description,
        meta:
          catalog.folders.length === 1
            ? "1 carpeta"
            : `${catalog.folders.length} carpetas`,
      })),
    [sortedCatalogs],
  );

  const folderOptions = useMemo(
    () =>
      sortedFolders.map((folder: MockFolder) => ({
        id: folder.id,
        label: folder.name,
        meta: `${folder.products.length} productos · ${folder.columns.length} columnas`,
      })),
    [sortedFolders],
  );

  return (
    <section className={styles.selectionPanel} aria-label="Selección de catálogo y carpeta">
      <div className={styles.dropdownRow}>
        <CustomDropdown
          label="Catálogo"
          options={catalogOptions}
          selectedId={selectedCatalogId}
          onSelect={onSelectCatalog}
        />

        <CustomDropdown
          label="Carpeta"
          options={folderOptions}
          selectedId={selectedFolderId}
          onSelect={onSelectFolder}
          disabled={!selectedCatalog || sortedFolders.length === 0}
          emptyMessage="Sin carpetas disponibles"
        />
      </div>
    </section>
  );
}
