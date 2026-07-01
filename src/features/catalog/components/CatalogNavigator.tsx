"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCatalogAction,
  deleteCatalogAction,
  updateCatalogAction,
} from "@/features/catalog/actions/catalog.actions";
import { createFolderAction, deleteFolderAction, updateFolderAction } from "@/features/catalog/actions/folder.actions";
import { CatalogFolderSelectors } from "@/features/catalog/components/CatalogFolderSelectors";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import { CatalogPageIntro } from "@/features/catalog/components/CatalogPageChrome";
import { LazyCatalogGlobalSearchResults } from "@/features/catalog/components/LazyCatalogGlobalSearchResults";
import { ProductFormModal } from "@/features/catalog/components/ProductFormModal";
import { ProductTable } from "@/features/catalog/components/ProductTable";
import { LazyImportWizard } from "@/features/imports/components/LazyImportWizard";
import type {
  CatalogNavigationFolderItem,
  DirectoryCatalogItem,
} from "@/features/catalog/types/catalog-navigator.types";
import type {
  GlobalSearchResponse,
  SearchResultItem,
} from "@/features/catalog/types/global-search.types";
import type { CatalogNavigationResponse } from "@/features/catalog/types/navigation.types";
import type { ProductTableResponse } from "@/features/catalog/types/product-table.types";
import { serializeColumnFilters, upsertColumnFilter } from "@/features/catalog/utils/column-filter-state";
import type { ColumnFilterInput } from "@/server/filters/column-filter.types";
import type { CatalogListItem } from "@/features/catalog/types/catalog.types";
import type { FolderListItem } from "@/features/catalog/types/folder.types";
import { sortByName } from "@/features/catalog/utils/sortByName";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const PAGE_SIZE = 25;
const MIN_GLOBAL_SEARCH_CHARS = 2;
const GLOBAL_SEARCH_PAGE_SIZE = 25;

type CatalogTarget = {
  id: string;
  name: string;
};

function toDirectoryCatalogItem(catalog: CatalogListItem): DirectoryCatalogItem {
  return {
    id: catalog.id,
    name: catalog.name,
    description: catalog.description,
    coverImageUrl: null,
    sectionCount: catalog.folderCount,
    updatedAt: catalog.updatedAt,
    order: catalog.order,
    offlineSync: { status: "unavailable" },
  };
}

function toNavigationFolderItem(folder: FolderListItem): CatalogNavigationFolderItem {
  return {
    id: folder.id,
    name: folder.name,
    description: folder.description,
    order: folder.order,
    visibleToNormalUser: folder.visibleToNormalUser,
    productCount: folder.productCount,
    updatedAt: folder.updatedAt,
  };
}

type CatalogNavigatorProps = {
  catalogs: DirectoryCatalogItem[];
  isAdmin?: boolean;
  enableColumnFilters?: boolean;
};

function getInitialCatalogId(catalogs: DirectoryCatalogItem[]): string {
  const sortedCatalogs = sortByName(catalogs);
  return sortedCatalogs[0]?.id ?? "";
}

function resolveCatalogId(
  catalogs: DirectoryCatalogItem[],
  selectedCatalogId: string,
): string {
  if (catalogs.length === 0) {
    return "";
  }

  const exists = catalogs.some((catalog) => catalog.id === selectedCatalogId);
  return exists ? selectedCatalogId : getInitialCatalogId(catalogs);
}

function resolveFolderId(
  folders: CatalogNavigationFolderItem[],
  selectedFolderId: string,
): string {
  if (folders.length === 0) {
    return "";
  }

  const exists = folders.some((folder) => folder.id === selectedFolderId);
  return exists ? selectedFolderId : sortByName(folders)[0]?.id ?? "";
}

export function CatalogNavigator({
  catalogs,
  isAdmin = false,
  enableColumnFilters = false,
}: CatalogNavigatorProps) {
  const router = useRouter();
  const [catalogList, setCatalogList] = useState(catalogs);
  const [prevCatalogs, setPrevCatalogs] = useState(catalogs);

  if (catalogs !== prevCatalogs) {
    setPrevCatalogs(catalogs);
    setCatalogList(catalogs);
  }

  const sortedCatalogs = useMemo(() => sortByName(catalogList), [catalogList]);

  const [selectedCatalogId, setSelectedCatalogId] = useState(() =>
    getInitialCatalogId(catalogs),
  );
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<ColumnFilterInput[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const [searchResetKey, setSearchResetKey] = useState(0);

  const isSearchActive = debouncedSearch.length >= MIN_GLOBAL_SEARCH_CHARS;
  const isSearchPending =
    debouncedSearch.length > 0 && debouncedSearch.length < MIN_GLOBAL_SEARCH_CHARS;

  const handleDebouncedSearchChange = useCallback((query: string) => {
    setDebouncedSearch(query);
    setSearchPage(1);
  }, []);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [productActionError, setProductActionError] = useState<string | null>(null);

  const [deleteCatalogTarget, setDeleteCatalogTarget] = useState<CatalogTarget | null>(
    null,
  );
  const [editCatalogTarget, setEditCatalogTarget] = useState<CatalogTarget | null>(
    null,
  );
  const [editCatalogNameDraft, setEditCatalogNameDraft] = useState("");
  const [isCatalogActionBusy, setIsCatalogActionBusy] = useState(false);
  const [catalogActionError, setCatalogActionError] = useState<string | null>(null);

  const [isCreateCatalogOpen, setIsCreateCatalogOpen] = useState(false);
  const [createCatalogNameDraft, setCreateCatalogNameDraft] = useState("");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [createFolderNameDraft, setCreateFolderNameDraft] = useState("");
  const [isFolderActionBusy, setIsFolderActionBusy] = useState(false);
  const [folderActionError, setFolderActionError] = useState<string | null>(null);

  const [deleteFolderTarget, setDeleteFolderTarget] = useState<CatalogTarget | null>(null);
  const [editFolderTarget, setEditFolderTarget] = useState<CatalogTarget | null>(null);
  const [editFolderNameDraft, setEditFolderNameDraft] = useState("");

  const activeCatalogId = useMemo(
    () => resolveCatalogId(sortedCatalogs, selectedCatalogId),
    [sortedCatalogs, selectedCatalogId],
  );

  const navigationQuery = useQuery({
    queryKey: ["admin", "navigation", activeCatalogId, reloadToken],
    queryFn: async (): Promise<CatalogNavigationFolderItem[]> => {
      const response = await fetch(
        `/api/admin/catalogs/${activeCatalogId}/navigation`,
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "No se pudieron cargar las carpetas.");
      }

      const data = (await response.json()) as CatalogNavigationResponse;
      return sortByName(data.folders);
    },
    enabled: Boolean(activeCatalogId),
  });

  const folders = navigationQuery.data ?? [];
  const isLoadingFolders = navigationQuery.isFetching && folders.length === 0;
  const foldersError =
    navigationQuery.error instanceof Error ? navigationQuery.error.message : null;

  const activeFolderId = useMemo(
    () => resolveFolderId(folders, selectedFolderId),
    [folders, selectedFolderId],
  );

  useEffect(() => {
    setColumnFilters([]);
    setPage(1);
  }, [activeFolderId]);

  const serializedColumnFilters = useMemo(
    () => serializeColumnFilters(columnFilters),
    [columnFilters],
  );

  const productsQuery = useQuery({
    queryKey: ["admin", "products", activeFolderId, page, serializedColumnFilters, reloadToken],
    queryFn: async (): Promise<ProductTableResponse> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        includeFullUrls: "false",
      });

      if (enableColumnFilters && columnFilters.length > 0) {
        params.set("filters", JSON.stringify(columnFilters));
      }

      const response = await fetch(
        `/api/admin/folders/${activeFolderId}/products?${params.toString()}`,
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "No se pudieron cargar los productos.");
      }

      return (await response.json()) as ProductTableResponse;
    },
    enabled: Boolean(activeFolderId) && debouncedSearch.length === 0,
    placeholderData: keepPreviousData,
  });

  const globalSearchQuery = useQuery({
    queryKey: ["admin", "global-search", debouncedSearch, searchPage],
    queryFn: async (): Promise<GlobalSearchResponse> => {
      const params = new URLSearchParams({
        q: debouncedSearch,
        page: String(searchPage),
        pageSize: String(GLOBAL_SEARCH_PAGE_SIZE),
      });

      const response = await fetch(`/api/admin/search/global?${params.toString()}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "No se pudo completar la búsqueda global.");
      }

      return (await response.json()) as GlobalSearchResponse;
    },
    enabled: isSearchActive,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const productTable = activeFolderId ? (productsQuery.data ?? null) : null;
  const isLoadingProducts = productsQuery.isFetching;
  const productsError =
    productsQuery.error instanceof Error ? productsQuery.error.message : null;

  const globalSearchError =
    globalSearchQuery.error instanceof Error ? globalSearchQuery.error.message : null;

  const handleSelectSearchResult = useCallback((item: SearchResultItem) => {
    setSelectedCatalogId(item.catalog.id);
    setSelectedFolderId(item.folder.id);
    setPage(1);
    setDebouncedSearch("");
    setSearchResetKey((token) => token + 1);
  }, []);

  const handleSearchPageChange = useCallback((nextPage: number) => {
    setSearchPage(nextPage);
  }, []);

  const handleSelectCatalog = useCallback((catalogId: string) => {
    setSelectedCatalogId(catalogId);
    setSelectedFolderId("");
    setPage(1);
  }, []);

  const handleSelectFolder = useCallback((folderId: string) => {
    setSelectedFolderId(folderId);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  const handleColumnFilterChange = useCallback(
    (columnInternalKey: string, filter: ColumnFilterInput | null) => {
      setColumnFilters((current) =>
        upsertColumnFilter(current, columnInternalKey, filter),
      );
      setPage(1);
    },
    [],
  );

  const handleClearColumnFilters = useCallback(() => {
    setColumnFilters([]);
    setPage(1);
  }, []);

  const handleImportExcelClick = useCallback(() => {
    setIsImportOpen(true);
  }, []);

  const handleAddProductClick = useCallback(() => {
    setProductActionError(null);

    if (!activeCatalogId) {
      setProductActionError("Seleccioná un catálogo para agregar productos.");
      return;
    }

    if (!activeFolderId) {
      setProductActionError("Seleccioná una carpeta para agregar productos.");
      return;
    }

    if (isLoadingProducts || !productTable) {
      setProductActionError("Esperá a que carguen los datos de la carpeta seleccionada.");
      return;
    }

    setIsProductFormOpen(true);
  }, [activeCatalogId, activeFolderId, isLoadingProducts, productTable]);

  const handleImportPublished = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const handleAddCatalog = useCallback(() => {
    setCatalogActionError(null);
    setCreateCatalogNameDraft("");
    setIsCreateCatalogOpen(true);
  }, []);

  const handleAddFolder = useCallback(() => {
    setFolderActionError(null);
    setCreateFolderNameDraft("");
    setIsCreateFolderOpen(true);
  }, []);

  const handleConfirmCreateCatalog = useCallback(async () => {
    const nextName = createCatalogNameDraft.trim();
    if (!nextName) {
      setCatalogActionError("El nombre no puede estar vacío.");
      return;
    }

    setIsCatalogActionBusy(true);
    setCatalogActionError(null);

    try {
      const result = await createCatalogAction({ name: nextName });
      if (!result.success) {
        setCatalogActionError(result.error);
        return;
      }

      const created = toDirectoryCatalogItem(result.data);
      setCatalogList((current) => sortByName([...current, created]));
      setSelectedCatalogId(created.id);
      setSelectedFolderId("");
      setPage(1);
      setIsCreateCatalogOpen(false);
      setCreateCatalogNameDraft("");
      router.refresh();
    } finally {
      setIsCatalogActionBusy(false);
    }
  }, [createCatalogNameDraft, router]);

  const handleConfirmCreateFolder = useCallback(async () => {
    if (!activeCatalogId) {
      return;
    }

    const nextName = createFolderNameDraft.trim();
    if (!nextName) {
      setFolderActionError("El nombre no puede estar vacío.");
      return;
    }

    setIsFolderActionBusy(true);
    setFolderActionError(null);

    try {
      const result = await createFolderAction({
        catalogId: activeCatalogId,
        name: nextName,
      });
      if (!result.success) {
        setFolderActionError(result.error);
        return;
      }

      const created = toNavigationFolderItem(result.data);
      setSelectedFolderId(created.id);
      setPage(1);
      setIsCreateFolderOpen(false);
      setCreateFolderNameDraft("");
      setReloadToken((token) => token + 1);
      router.refresh();
    } finally {
      setIsFolderActionBusy(false);
    }
  }, [activeCatalogId, createFolderNameDraft, router]);

  const handleEditCatalog = useCallback(
    (catalogId: string) => {
      const catalog = catalogList.find((item) => item.id === catalogId);
      if (!catalog) {
        return;
      }
      setCatalogActionError(null);
      setEditCatalogTarget({ id: catalog.id, name: catalog.name });
      setEditCatalogNameDraft(catalog.name);
    },
    [catalogList],
  );

  const handleDeleteCatalog = useCallback(
    (catalogId: string) => {
      const catalog = catalogList.find((item) => item.id === catalogId);
      if (!catalog) {
        return;
      }
      setCatalogActionError(null);
      setDeleteCatalogTarget({ id: catalog.id, name: catalog.name });
    },
    [catalogList],
  );

  const handleEditFolder = useCallback(
    (folderId: string) => {
      const folder = folders.find((item) => item.id === folderId);
      if (!folder) {
        return;
      }
      setFolderActionError(null);
      setEditFolderTarget({ id: folder.id, name: folder.name });
      setEditFolderNameDraft(folder.name);
    },
    [folders],
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      const folder = folders.find((item) => item.id === folderId);
      if (!folder) {
        return;
      }
      setFolderActionError(null);
      setDeleteFolderTarget({ id: folder.id, name: folder.name });
    },
    [folders],
  );

  const handleConfirmDeleteFolder = useCallback(async () => {
    if (!deleteFolderTarget) {
      return;
    }

    setIsFolderActionBusy(true);
    setFolderActionError(null);

    try {
      const result = await deleteFolderAction({ folderId: deleteFolderTarget.id });
      if (!result.success) {
        setFolderActionError(result.error);
        return;
      }

      const nextFolders = folders.filter(
        (folder) => folder.id !== deleteFolderTarget.id,
      );

      setCatalogList((current) =>
        current.map((catalog) =>
          catalog.id === activeCatalogId
            ? {
                ...catalog,
                sectionCount: Math.max(0, catalog.sectionCount - 1),
              }
            : catalog,
        ),
      );

      if (selectedFolderId === deleteFolderTarget.id) {
        const nextFolderId = sortByName(nextFolders)[0]?.id ?? "";
        setSelectedFolderId(nextFolderId);
        setPage(1);
      }

      setDeleteFolderTarget(null);
      setReloadToken((token) => token + 1);
      router.refresh();
    } finally {
      setIsFolderActionBusy(false);
    }
  }, [
    activeCatalogId,
    deleteFolderTarget,
    folders,
    router,
    selectedFolderId,
  ]);

  const handleConfirmEditFolder = useCallback(async () => {
    if (!editFolderTarget) {
      return;
    }

    const nextName = editFolderNameDraft.trim();
    if (!nextName) {
      setFolderActionError("El nombre no puede estar vacío.");
      return;
    }

    setIsFolderActionBusy(true);
    setFolderActionError(null);

    try {
      const result = await updateFolderAction({
        id: editFolderTarget.id,
        name: nextName,
      });
      if (!result.success) {
        setFolderActionError(result.error);
        return;
      }

      setEditFolderTarget(null);
      setEditFolderNameDraft("");
      setReloadToken((token) => token + 1);
      router.refresh();
    } finally {
      setIsFolderActionBusy(false);
    }
  }, [editFolderNameDraft, editFolderTarget, router]);

  const handleConfirmDeleteCatalog = useCallback(async () => {
    if (!deleteCatalogTarget) {
      return;
    }

    setIsCatalogActionBusy(true);
    setCatalogActionError(null);

    try {
      const result = await deleteCatalogAction({ catalogId: deleteCatalogTarget.id });
      if (!result.success) {
        setCatalogActionError(result.error);
        return;
      }

      const nextCatalogs = catalogList.filter(
        (catalog) => catalog.id !== deleteCatalogTarget.id,
      );
      setCatalogList(nextCatalogs);

      if (selectedCatalogId === deleteCatalogTarget.id) {
        const nextCatalogId = sortByName(nextCatalogs)[0]?.id ?? "";
        setSelectedCatalogId(nextCatalogId);
        setSelectedFolderId("");
        setPage(1);
      }

      setDeleteCatalogTarget(null);
      router.refresh();
    } finally {
      setIsCatalogActionBusy(false);
    }
  }, [catalogList, deleteCatalogTarget, router, selectedCatalogId]);

  const handleConfirmEditCatalog = useCallback(async () => {
    if (!editCatalogTarget) {
      return;
    }

    const nextName = editCatalogNameDraft.trim();
    if (!nextName) {
      setCatalogActionError("El nombre no puede estar vacío.");
      return;
    }

    setIsCatalogActionBusy(true);
    setCatalogActionError(null);

    try {
      const result = await updateCatalogAction({
        id: editCatalogTarget.id,
        name: nextName,
      });
      if (!result.success) {
        setCatalogActionError(result.error);
        return;
      }

      const updated = toDirectoryCatalogItem(result.data);
      setCatalogList((current) =>
        current.map((catalog) =>
          catalog.id === updated.id ? updated : catalog,
        ),
      );
      setEditCatalogTarget(null);
      setEditCatalogNameDraft("");
      router.refresh();
    } finally {
      setIsCatalogActionBusy(false);
    }
  }, [editCatalogNameDraft, editCatalogTarget, router]);

  const editNameUnchanged =
    editCatalogTarget !== null &&
    editCatalogNameDraft.trim() === editCatalogTarget.name.trim();
  const editNameEmpty = editCatalogNameDraft.trim().length === 0;

  const editFolderNameUnchanged =
    editFolderTarget !== null &&
    editFolderNameDraft.trim() === editFolderTarget.name.trim();
  const editFolderNameEmpty = editFolderNameDraft.trim().length === 0;

  const createCatalogNameEmpty = createCatalogNameDraft.trim().length === 0;
  const createFolderNameEmpty = createFolderNameDraft.trim().length === 0;

  const importWizard = isImportOpen ? (
    <LazyImportWizard
      catalogs={sortedCatalogs}
      onClose={() => setIsImportOpen(false)}
      onPublished={handleImportPublished}
    />
  ) : null;

  const visibleFolders = activeCatalogId ? folders : [];
  const tableData = activeFolderId ? productTable : null;

  return (
    <>
      <div className={styles.page}>
        <div className={styles.body}>
          <CatalogPageIntro
            onDebouncedSearchChange={handleDebouncedSearchChange}
            searchResetKey={searchResetKey}
            onImportExcelClick={handleImportExcelClick}
            onAddProductClick={isAdmin ? handleAddProductClick : undefined}
          >
            <CatalogFolderSelectors
              catalogs={sortedCatalogs}
              folders={visibleFolders}
              selectedCatalogId={activeCatalogId}
              selectedFolderId={activeFolderId}
              isLoadingFolders={isLoadingFolders}
              onSelectCatalog={handleSelectCatalog}
              onSelectFolder={handleSelectFolder}
              onEditCatalog={handleEditCatalog}
              onDeleteCatalog={handleDeleteCatalog}
              onEditFolder={handleEditFolder}
              onDeleteFolder={handleDeleteFolder}
              onAddCatalog={handleAddCatalog}
              onAddFolder={handleAddFolder}
            />
          </CatalogPageIntro>

        {foldersError ? <p className={styles.inlineError}>{foldersError}</p> : null}
        {catalogActionError ? (
          <p className={styles.inlineError}>{catalogActionError}</p>
        ) : null}
        {folderActionError ? (
          <p className={styles.inlineError}>{folderActionError}</p>
        ) : null}
        {productActionError ? (
          <p className={styles.inlineError}>{productActionError}</p>
        ) : null}

        {isSearchActive ? (
          <LazyCatalogGlobalSearchResults
            data={globalSearchQuery.data ?? null}
            searchQuery={debouncedSearch}
            isLoading={globalSearchQuery.isFetching}
            error={globalSearchError}
            onPageChange={handleSearchPageChange}
            onSelectResult={handleSelectSearchResult}
          />
        ) : isSearchPending ? (
          <p className={styles.searchHint} role="status">
            Escribí al menos {MIN_GLOBAL_SEARCH_CHARS} caracteres para buscar en todos los
            catálogos.
          </p>
        ) : (
          <ProductTable
            data={tableData}
            isLoading={isLoadingProducts || isLoadingFolders}
            error={productsError}
            onPageChange={handlePageChange}
            enableColumnFilters={enableColumnFilters}
            columnFilters={columnFilters}
            onColumnFilterChange={handleColumnFilterChange}
            onClearColumnFilters={handleClearColumnFilters}
          />
        )}
      </div>
      </div>
      {importWizard}
      {isProductFormOpen && productTable ? (
        <ProductFormModal
          folderId={productTable.folder.id}
          folderName={productTable.folder.name}
          columns={productTable.columns}
          onClose={() => setIsProductFormOpen(false)}
          onSaved={() => {
            setReloadToken((token) => token + 1);
            setPage(1);
            router.refresh();
          }}
        />
      ) : null}
      {deleteCatalogTarget ? (
        <ConfirmDialog
          title="Eliminar catálogo"
          message={
            <>
              ¿Eliminar el catálogo{" "}
              <strong className={styles.confirmHighlight}>
                {deleteCatalogTarget.name}
              </strong>
              ? También se eliminarán todas sus carpetas y productos. Esta acción no
              se puede deshacer.
            </>
          }
          confirmLabel="Eliminar"
          variant="danger"
          isBusy={isCatalogActionBusy}
          onConfirm={() => void handleConfirmDeleteCatalog()}
          onCancel={() => {
            if (!isCatalogActionBusy) {
              setDeleteCatalogTarget(null);
            }
          }}
        />
      ) : null}
      {editCatalogTarget ? (
        <ConfirmDialog
          title="Editar catálogo"
          message={
            <>
              ¿Confirmás el cambio de nombre del catálogo{" "}
              <strong className={styles.confirmHighlight}>
                {editCatalogTarget.name}
              </strong>
              ?
            </>
          }
          confirmLabel="Guardar cambios"
          isBusy={isCatalogActionBusy}
          confirmDisabled={editNameEmpty || editNameUnchanged}
          onConfirm={() => void handleConfirmEditCatalog()}
          onCancel={() => {
            if (!isCatalogActionBusy) {
              setEditCatalogTarget(null);
              setEditCatalogNameDraft("");
            }
          }}
        >
          <input
            className={styles.confirmInput}
            value={editCatalogNameDraft}
            onChange={(event) => setEditCatalogNameDraft(event.target.value)}
            maxLength={200}
            autoFocus
            disabled={isCatalogActionBusy}
            aria-label="Nuevo nombre del catálogo"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !editNameEmpty &&
                !editNameUnchanged &&
                !isCatalogActionBusy
              ) {
                event.preventDefault();
                void handleConfirmEditCatalog();
              }
            }}
          />
        </ConfirmDialog>
      ) : null}
      {isCreateCatalogOpen ? (
        <ConfirmDialog
          title="Nuevo catálogo"
          message="Ingresá el nombre del catálogo que querés crear."
          confirmLabel="Crear catálogo"
          isBusy={isCatalogActionBusy}
          confirmDisabled={createCatalogNameEmpty}
          onConfirm={() => void handleConfirmCreateCatalog()}
          onCancel={() => {
            if (!isCatalogActionBusy) {
              setIsCreateCatalogOpen(false);
              setCreateCatalogNameDraft("");
            }
          }}
        >
          <input
            className={styles.confirmInput}
            value={createCatalogNameDraft}
            onChange={(event) => setCreateCatalogNameDraft(event.target.value)}
            maxLength={200}
            autoFocus
            disabled={isCatalogActionBusy}
            aria-label="Nombre del catálogo"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !createCatalogNameEmpty &&
                !isCatalogActionBusy
              ) {
                event.preventDefault();
                void handleConfirmCreateCatalog();
              }
            }}
          />
        </ConfirmDialog>
      ) : null}
      {isCreateFolderOpen ? (
        <ConfirmDialog
          title="Nueva carpeta"
          message="Ingresá el nombre de la carpeta que querés crear en este catálogo."
          confirmLabel="Crear carpeta"
          isBusy={isFolderActionBusy}
          confirmDisabled={createFolderNameEmpty}
          onConfirm={() => void handleConfirmCreateFolder()}
          onCancel={() => {
            if (!isFolderActionBusy) {
              setIsCreateFolderOpen(false);
              setCreateFolderNameDraft("");
            }
          }}
        >
          <input
            className={styles.confirmInput}
            value={createFolderNameDraft}
            onChange={(event) => setCreateFolderNameDraft(event.target.value)}
            maxLength={200}
            autoFocus
            disabled={isFolderActionBusy}
            aria-label="Nombre de la carpeta"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !createFolderNameEmpty &&
                !isFolderActionBusy
              ) {
                event.preventDefault();
                void handleConfirmCreateFolder();
              }
            }}
          />
        </ConfirmDialog>
      ) : null}
      {deleteFolderTarget ? (
        <ConfirmDialog
          title="Eliminar carpeta"
          message={
            <>
              ¿Eliminar la carpeta{" "}
              <strong className={styles.confirmHighlight}>
                {deleteFolderTarget.name}
              </strong>
              ? También se eliminarán todos sus productos. Esta acción no se puede
              deshacer.
            </>
          }
          confirmLabel="Eliminar"
          variant="danger"
          isBusy={isFolderActionBusy}
          onConfirm={() => void handleConfirmDeleteFolder()}
          onCancel={() => {
            if (!isFolderActionBusy) {
              setDeleteFolderTarget(null);
            }
          }}
        />
      ) : null}
      {editFolderTarget ? (
        <ConfirmDialog
          title="Editar carpeta"
          message={
            <>
              ¿Confirmás el cambio de nombre de la carpeta{" "}
              <strong className={styles.confirmHighlight}>
                {editFolderTarget.name}
              </strong>
              ?
            </>
          }
          confirmLabel="Guardar cambios"
          isBusy={isFolderActionBusy}
          confirmDisabled={editFolderNameEmpty || editFolderNameUnchanged}
          onConfirm={() => void handleConfirmEditFolder()}
          onCancel={() => {
            if (!isFolderActionBusy) {
              setEditFolderTarget(null);
              setEditFolderNameDraft("");
            }
          }}
        >
          <input
            className={styles.confirmInput}
            value={editFolderNameDraft}
            onChange={(event) => setEditFolderNameDraft(event.target.value)}
            maxLength={200}
            autoFocus
            disabled={isFolderActionBusy}
            aria-label="Nuevo nombre de la carpeta"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !editFolderNameEmpty &&
                !editFolderNameUnchanged &&
                !isFolderActionBusy
              ) {
                event.preventDefault();
                void handleConfirmEditFolder();
              }
            }}
          />
        </ConfirmDialog>
      ) : null}
    </>
  );
}
