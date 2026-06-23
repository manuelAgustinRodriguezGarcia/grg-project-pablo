"use client";

import { useMemo, useState } from "react";
import { CustomDropdown } from "@/features/catalog/components/CustomDropdown";
import type { DirectoryCatalogItem } from "@/features/directory/types/directory.types";
import type { CatalogNavigationFolderItem } from "@/features/catalog/types/navigation.types";
import type { ImportSheetItem } from "@/features/imports/types/import-job.types";
import type { StagedExternalImagesSummary } from "@/features/imports/utils/external-images";
import { hasStagedExternalImagesSummary } from "@/features/imports/utils/external-images";
import { ImportStagedExternalImagesField } from "./ImportStagedExternalImagesField";
import { Plus, FileSpreadsheet, TableProperties, ICON_STROKE } from "@/shared/icons";
import styles from "./ImportWizard.module.scss";

type ImportStepDestinationProps = {
  fileName: string;
  stagedExternalImages?: StagedExternalImagesSummary | null;
  catalogs: DirectoryCatalogItem[];
  folders: CatalogNavigationFolderItem[];
  importableSheets: ImportSheetItem[];
  excludedSheetCount: number;
  selectedCatalogId: string;
  selectedFolderId: string;
  selectedSheetName: string;
  isLoadingFolders: boolean;
  isBusy: boolean;
  onSelectCatalog: (catalogId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onSelectSheet: (sheetName: string) => void;
  onCreateCatalog: (name: string) => Promise<boolean>;
  onCreateFolder: (name: string) => Promise<boolean>;
  onEditCatalog?: (catalogId: string) => void;
  onDeleteCatalog?: (catalogId: string) => void;
};

export function ImportStepDestination({
  fileName,
  stagedExternalImages = null,
  catalogs,
  folders,
  importableSheets,
  excludedSheetCount,
  selectedCatalogId,
  selectedFolderId,
  selectedSheetName,
  isLoadingFolders,
  isBusy,
  onSelectCatalog,
  onSelectFolder,
  onSelectSheet,
  onCreateCatalog,
  onCreateFolder,
  onEditCatalog,
  onDeleteCatalog,
}: ImportStepDestinationProps) {
  const [catalogDraft, setCatalogDraft] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState<string | null>(null);

  const catalogOptions = useMemo(
    () =>
      catalogs.map((catalog) => ({
        id: catalog.id,
        label: catalog.name,
        meta:
          catalog.sectionCount === 1
            ? "1 carpeta"
            : `${catalog.sectionCount} carpetas`,
      })),
    [catalogs],
  );

  const folderOptions = useMemo(
    () =>
      folders.map((folder) => ({
        id: folder.id,
        label: folder.name,
        meta:
          folder.productCount === 0
            ? "vacía"
            : folder.productCount === 1
              ? "1 producto"
              : `${folder.productCount} productos`,
      })),
    [folders],
  );

  const sheetOptions = useMemo(
    () =>
      importableSheets.map((sheet) => ({
        id: sheet.sheetName,
        label: sheet.sheetName,
        meta:
          sheet.rowCount === 1 ? "1 fila" : `${sheet.rowCount} filas`,
      })),
    [importableSheets],
  );

  async function submitCatalog() {
    const name = (catalogDraft ?? "").trim();
    if (!name) {
      return;
    }
    const ok = await onCreateCatalog(name);
    if (ok) {
      setCatalogDraft(null);
    }
  }

  async function submitFolder() {
    const name = (folderDraft ?? "").trim();
    if (!name) {
      return;
    }
    const ok = await onCreateFolder(name);
    if (ok) {
      setFolderDraft(null);
    }
  }

  return (
    <div>
      <div className={styles.importSourceField}>
        <div className={styles.fieldHeader}>
          <span className={styles.fieldLabel}>Importando de:</span>
        </div>
        <div className={styles.importSource}>
          <span className={styles.importSourceIcon}>
            <FileSpreadsheet strokeWidth={ICON_STROKE} aria-hidden />
          </span>
          <span className={styles.importSourceFileName}>{fileName}</span>
        </div>
      </div>

      {hasStagedExternalImagesSummary(stagedExternalImages) ? (
        <ImportStagedExternalImagesField summary={stagedExternalImages} />
      ) : null}

      <div className={styles.destinationHint}>
        <span className={styles.destinationHintIcon} aria-hidden>
          <TableProperties strokeWidth={ICON_STROKE} />
        </span>
        <p className={styles.destinationHintText}>
          Seleccione en que catálogo y carpeta desea guardar la lista de productos.
        </p>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldHeader}>
          <span className={styles.fieldLabel}>Catálogo</span>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => setCatalogDraft((value) => (value === null ? "" : null))}
            disabled={isBusy}
          >
            <Plus strokeWidth={ICON_STROKE} aria-hidden />
            Agregar
          </button>
        </div>

        <CustomDropdown
          label=""
          options={catalogOptions}
          selectedId={selectedCatalogId}
          onSelect={onSelectCatalog}
          onOptionEdit={onEditCatalog}
          onOptionDelete={onDeleteCatalog}
          disabled={isBusy || catalogOptions.length === 0}
          placeholder="Seleccione el catálogo"
          emptyMessage="Sin catálogos disponibles"
        />

        {catalogDraft !== null ? (
          <div className={styles.inlineForm}>
            <input
              className={styles.inlineInput}
              value={catalogDraft}
              onChange={(event) => setCatalogDraft(event.target.value)}
              placeholder="Nombre del nuevo catálogo"
              maxLength={200}
              autoFocus
              disabled={isBusy}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitCatalog();
                }
              }}
            />
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void submitCatalog()}
              disabled={isBusy || catalogDraft.trim().length === 0}
            >
              Crear
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.field}>
        <div className={styles.fieldHeader}>
          <span className={styles.fieldLabel}>Carpeta</span>
          <button
            type="button"
            className={styles.addButton}
            onClick={() =>
              setFolderDraft((value) =>
                value === null ? selectedSheetName : null,
              )
            }
            disabled={isBusy || !selectedCatalogId}
          >
            <Plus strokeWidth={ICON_STROKE} aria-hidden />
            Agregar
          </button>
        </div>

        <CustomDropdown
          label=""
          options={folderOptions}
          selectedId={selectedFolderId}
          onSelect={onSelectFolder}
          disabled={isBusy || !selectedCatalogId || isLoadingFolders || folderOptions.length === 0}
          placeholder="Seleccione la carpeta"
          preferPlaceholderWithoutOptions={!selectedCatalogId}
          emptyMessage={
            isLoadingFolders ? "Cargando carpetas…" : "Sin carpetas disponibles"
          }
        />

        {folderDraft !== null ? (
          <div className={styles.inlineForm}>
            <input
              className={styles.inlineInput}
              value={folderDraft}
              onChange={(event) => setFolderDraft(event.target.value)}
              placeholder="Nombre de la nueva carpeta"
              maxLength={200}
              autoFocus
              disabled={isBusy}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitFolder();
                }
              }}
            />
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void submitFolder()}
              disabled={isBusy || folderDraft.trim().length === 0}
            >
              Crear
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.field}>
        <div className={styles.fieldHeader}>
          <span className={styles.fieldLabel}>Página a importar</span>
        </div>

        <CustomDropdown
          label=""
          options={sheetOptions}
          selectedId={selectedSheetName}
          onSelect={onSelectSheet}
          disabled={isBusy || sheetOptions.length === 0}
          placeholder="Seleccione la página"
          emptyMessage="No hay páginas importables"
        />

        {excludedSheetCount > 0 ? (
          <p className={styles.sheetNote}>
            Se omitieron {excludedSheetCount}{" "}
            {excludedSheetCount === 1 ? "página" : "páginas"} que no contienen una
            tabla de productos válida.
          </p>
        ) : null}
      </div>
    </div>
  );
}
