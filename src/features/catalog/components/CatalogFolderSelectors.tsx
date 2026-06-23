"use client";

import { useMemo } from "react";
import { CustomDropdown } from "@/features/catalog/components/CustomDropdown";
import type {
  CatalogNavigationFolderItem,
  DirectoryCatalogItem,
} from "@/features/catalog/types/catalog-navigator.types";
import { sortByName } from "@/features/catalog/utils/sortByName";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type CatalogFolderSelectorsProps = {
  catalogs: DirectoryCatalogItem[];
  folders: CatalogNavigationFolderItem[];
  selectedCatalogId: string;
  selectedFolderId: string;
  isLoadingFolders: boolean;
  onSelectCatalog: (catalogId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onEditCatalog?: (catalogId: string) => void;
  onDeleteCatalog?: (catalogId: string) => void;
  onEditFolder?: (folderId: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onAddCatalog?: () => void;
  onAddFolder?: () => void;
};

export function CatalogFolderSelectors({
  catalogs,
  folders,
  selectedCatalogId,
  selectedFolderId,
  isLoadingFolders,
  onSelectCatalog,
  onSelectFolder,
  onEditCatalog,
  onDeleteCatalog,
  onEditFolder,
  onDeleteFolder,
  onAddCatalog,
  onAddFolder,
}: CatalogFolderSelectorsProps) {
  const sortedCatalogs = useMemo(() => sortByName(catalogs), [catalogs]);
  const sortedFolders = useMemo(() => sortByName(folders), [folders]);

  const catalogOptions = useMemo(
    () =>
      sortedCatalogs.map((catalog) => ({
        id: catalog.id,
        label: catalog.name,
        description: catalog.description ?? undefined,
        meta:
          catalog.sectionCount === 1
            ? "1 carpeta"
            : `${catalog.sectionCount} carpetas`,
      })),
    [sortedCatalogs],
  );

  const folderOptions = useMemo(
    () =>
      sortedFolders.map((folder) => ({
        id: folder.id,
        label: folder.name,
        meta:
          folder.productCount === 1
            ? "1 producto"
            : `${folder.productCount} productos`,
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
          onOptionEdit={onEditCatalog}
          onOptionDelete={onDeleteCatalog}
          onAdd={onAddCatalog}
          disabled={sortedCatalogs.length === 0}
          addDisabled={false}
          emptyMessage="Sin catálogos disponibles"
        />

        <CustomDropdown
          label="Carpeta"
          options={folderOptions}
          selectedId={selectedFolderId}
          onSelect={onSelectFolder}
          onOptionEdit={onEditFolder}
          onOptionDelete={onDeleteFolder}
          onAdd={onAddFolder}
          disabled={
            !selectedCatalogId ||
            isLoadingFolders ||
            sortedFolders.length === 0
          }
          addDisabled={!selectedCatalogId || isLoadingFolders}
          emptyMessage={
            isLoadingFolders ? "Cargando carpetas…" : "Sin carpetas disponibles"
          }
        />
      </div>
    </section>
  );
}
