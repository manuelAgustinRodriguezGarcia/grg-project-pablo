"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminQueryKeys } from "@/features/admin/query-keys";
import {
  createCatalogAction,
  deleteCatalogAction,
  updateCatalogAction,
} from "@/features/catalog/actions/catalog.actions";
import { createFolderAction, deleteFolderAction, updateFolderAction } from "@/features/catalog/actions/folder.actions";
import { CatalogFolderSelectors } from "@/features/catalog/components/CatalogFolderSelectors";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import { CatalogPageIntro } from "@/features/catalog/components/CatalogPageChrome";
import { LazyProductFormModal } from "@/features/catalog/components/LazyProductFormModal";
import { ProductTable } from "@/features/catalog/components/ProductTable";
import { LazyImportWizard } from "@/features/imports/components/LazyImportWizard";
import { deleteProductAction } from "@/features/records/actions/product.actions";
import type {
  CatalogNavigationFolderItem,
  DirectoryCatalogItem,
} from "@/features/catalog/types/catalog-navigator.types";
import type {
  GlobalSearchResponse,
} from "@/features/catalog/types/global-search.types";
import type { CatalogNavigationResponse } from "@/features/catalog/types/navigation.types";
import type { ProductTableItem, ProductTableResponse } from "@/features/catalog/types/product-table.types";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import { serializeColumnFilters, upsertColumnFilter } from "@/features/catalog/utils/column-filter-state";
import {
  getProductTableColumns,
} from "@/features/catalog/utils/product-table-columns";
import type { ProductFolderSearchGroup } from "@/features/catalog/utils/group-search-results-by-folder";
import type { ColumnFilterInput } from "@/server/filters/column-filter.types";
import type { CatalogListItem } from "@/features/catalog/types/catalog.types";
import type { FolderListItem } from "@/features/catalog/types/folder.types";
import { sortByName } from "@/features/catalog/utils/sortByName";
import { useReplaceSearchParams } from "@/shared/hooks/useReplaceSearchParams";
import { normalizeMultilineText } from "@/shared/text/normalize-multiline-text";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const PAGE_SIZE = 100;
const MIN_GLOBAL_SEARCH_CHARS = 2;
const GLOBAL_SEARCH_DROPDOWN_PAGE_SIZE = 8;
const DELETE_PRODUCT_PREVIEW_COLUMN_COUNT = 3;

type CatalogTarget = {
  id: string;
  name: string;
};

function getDeleteProductPreviewColumns(columns: ColumnListItem[]): ColumnListItem[] {
  return getProductTableColumns(
    [...columns].sort((left, right) => left.order - right.order),
  ).slice(0, DELETE_PRODUCT_PREVIEW_COLUMN_COUNT);
}

function formatDeleteProductPreviewValue(
  product: ProductTableItem,
  column: ColumnListItem,
): string {
  let value: unknown;

  if (column.isPrimaryCode) {
    value = product.primaryCode;
  } else if (column.isDescription) {
    value = product.description;
  } else {
    value = product.dynamicData[column.internalKey];
  }

  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return normalizeMultilineText(String(value));
}

function formatDeleteProductPreviewHeader(displayName: string): string {
  return displayName.replace(/\r\n/g, "\n").replace(/\n+/g, " ").trim();
}

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
  initialCatalogId?: string;
  initialFolderId?: string;
  canEdit?: boolean;
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
  options?: { allowFallback?: boolean },
): string {
  const allowFallback = options?.allowFallback ?? true;

  if (folders.length === 0) {
    // Keep a pending deep-link / global-search target while folders load.
    return selectedFolderId;
  }

  const exists = folders.some((folder) => folder.id === selectedFolderId);
  if (exists) {
    return selectedFolderId;
  }

  if (!allowFallback) {
    return selectedFolderId;
  }

  return sortByName(folders)[0]?.id ?? "";
}

export function CatalogNavigator({
  catalogs,
  initialCatalogId = "",
  initialFolderId = "",
  canEdit = false,
  isAdmin = false,
  enableColumnFilters = false,
}: CatalogNavigatorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const replaceParams = useReplaceSearchParams();
  const stableTableFolderIdRef = useRef<string | null>(null);
  const stableTableDataRef = useRef<ProductTableResponse | null>(null);
  const [catalogList, setCatalogList] = useState(catalogs);
  const [prevCatalogs, setPrevCatalogs] = useState(catalogs);

  if (catalogs !== prevCatalogs) {
    setPrevCatalogs(catalogs);
    setCatalogList(catalogs);
  }

  const sortedCatalogs = useMemo(() => sortByName(catalogList), [catalogList]);

  const [selectedCatalogId, setSelectedCatalogId] = useState(() =>
    resolveCatalogId(catalogs, initialCatalogId),
  );
  const [selectedFolderId, setSelectedFolderId] = useState(() =>
    initialCatalogId &&
    catalogs.some((catalog) => catalog.id === initialCatalogId)
      ? initialFolderId
      : "",
  );
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<ColumnFilterInput[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [folderSearch, setFolderSearch] = useState("");
  const [folderSearchSeedValue, setFolderSearchSeedValue] = useState("");
  const [folderSearchResetKey, setFolderSearchResetKey] = useState(0);

  const isSearchActive = debouncedSearch.length >= MIN_GLOBAL_SEARCH_CHARS;

  const handleDebouncedSearchChange = useCallback((query: string) => {
    setDebouncedSearch(query);
  }, []);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductTableItem | null>(null);
  const [deleteProductTarget, setDeleteProductTarget] = useState<ProductTableItem | null>(
    null,
  );
  const [isProductActionBusy, setIsProductActionBusy] = useState(false);
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

  const invalidateCatalogQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: adminQueryKeys.navigation(activeCatalogId) });
    void queryClient.invalidateQueries({ queryKey: adminQueryKeys.products() });
  }, [activeCatalogId, queryClient]);

  const navigationQuery = useQuery({
    queryKey: adminQueryKeys.navigation(activeCatalogId),
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
    placeholderData: keepPreviousData,
  });

  const folders = useMemo(() => navigationQuery.data ?? [], [navigationQuery.data]);
  const isNavigationReady =
    Boolean(activeCatalogId) &&
    navigationQuery.isFetched &&
    !navigationQuery.isPlaceholderData;
  const isLoadingFolders =
    Boolean(activeCatalogId) &&
    (!isNavigationReady || (navigationQuery.isFetching && folders.length === 0));
  const foldersError =
    navigationQuery.error instanceof Error ? navigationQuery.error.message : null;

  const activeFolderId = useMemo(
    () =>
      resolveFolderId(folders, selectedFolderId, {
        // While folders for the target catalog are still loading (or showing
        // keepPreviousData from another catalog), never fall back to the first
        // folder — that would wipe a global-search handoff mid-flight.
        allowFallback: isNavigationReady,
      }),
    [folders, isNavigationReady, selectedFolderId],
  );

  const canLoadFolderProducts =
    Boolean(activeFolderId) &&
    isNavigationReady &&
    folders.some((folder) => folder.id === activeFolderId);

  useEffect(() => {
    if (!activeCatalogId) {
      replaceParams({ catalog: null, folder: null });
      return;
    }

    // Preserve deep-linked folder while this catalog's folders load;
    // avoid writing a stale folder from keepPreviousData of another catalog.
    if (!navigationQuery.isFetched || navigationQuery.isPlaceholderData) {
      replaceParams({
        catalog: activeCatalogId,
        folder: selectedFolderId || null,
      });
      return;
    }

    replaceParams({
      catalog: activeCatalogId,
      folder: activeFolderId || null,
    });
  }, [
    activeCatalogId,
    activeFolderId,
    navigationQuery.isFetched,
    navigationQuery.isPlaceholderData,
    replaceParams,
    selectedFolderId,
  ]);

  const serializedColumnFilters = useMemo(
    () => serializeColumnFilters(columnFilters),
    [columnFilters],
  );

  const productsQuery = useQuery({
    queryKey: adminQueryKeys.products(
      activeFolderId,
      page,
      serializedColumnFilters,
      folderSearch,
    ),
    queryFn: async (): Promise<ProductTableResponse> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        includeFullUrls: "false",
      });

      if (enableColumnFilters && columnFilters.length > 0) {
        params.set("filters", JSON.stringify(columnFilters));
      }

      if (folderSearch) {
        params.set("q", folderSearch);
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
    enabled: canLoadFolderProducts,
    placeholderData: keepPreviousData,
  });

  const globalSearchQuery = useQuery({
    queryKey: adminQueryKeys.globalSearch(
      debouncedSearch,
      GLOBAL_SEARCH_DROPDOWN_PAGE_SIZE,
    ),
    queryFn: async ({ signal }): Promise<GlobalSearchResponse> => {
      const params = new URLSearchParams({
        q: debouncedSearch,
        page: "1",
        pageSize: String(GLOBAL_SEARCH_DROPDOWN_PAGE_SIZE),
      });

      const response = await fetch(`/api/admin/search/global?${params.toString()}`, {
        signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "No se pudo completar la búsqueda global.");
      }

      return (await response.json()) as GlobalSearchResponse;
    },
    enabled: isSearchActive,
    staleTime: 0,
  });

  const productTable = canLoadFolderProducts ? (productsQuery.data ?? null) : null;

  const deleteProductPreviewColumns = useMemo(
    () =>
      productTable && deleteProductTarget
        ? getDeleteProductPreviewColumns(productTable.columns)
        : [],
    [deleteProductTarget, productTable],
  );
  const isLoadingProducts =
    productsQuery.isFetching || (Boolean(activeFolderId) && !canLoadFolderProducts);
  const productsError =
    productsQuery.error instanceof Error ? productsQuery.error.message : null;

  if (canLoadFolderProducts && productTable) {
    stableTableFolderIdRef.current = activeFolderId;
    stableTableDataRef.current = productTable;
  } else if (!canLoadFolderProducts) {
    // Drop stale table snapshots while navigating to another catalog/folder
    // (e.g. global-search handoff) so we never filter the wrong rubro.
    stableTableFolderIdRef.current = null;
    stableTableDataRef.current = null;
  }

  const tableData =
    canLoadFolderProducts && productTable
      ? productTable
      : canLoadFolderProducts &&
          stableTableFolderIdRef.current === activeFolderId &&
          stableTableDataRef.current
        ? stableTableDataRef.current
        : null;

  const handleColumnsChanged = useCallback(() => {
    if (!activeFolderId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: adminQueryKeys.products(activeFolderId),
    });
  }, [activeFolderId, queryClient]);

  const globalSearchError =
    globalSearchQuery.error instanceof Error ? globalSearchQuery.error.message : null;

  const handleSelectProductFolderSearchResult = useCallback(
    (group: ProductFolderSearchGroup) => {
      const seed = debouncedSearch.trim();
      setSelectedCatalogId(group.catalogId);
      setSelectedFolderId(group.folderId);
      setPage(1);
      setColumnFilters([]);
      setDebouncedSearch("");
      setSearchResetKey((token) => token + 1);
      setFolderSearch(seed);
      setFolderSearchSeedValue(seed);
      setFolderSearchResetKey((token) => token + 1);
    },
    [debouncedSearch],
  );

  const handleSelectFolderSearchResult = useCallback(
    (catalogId: string, folderId: string) => {
      setSelectedCatalogId(catalogId);
      setSelectedFolderId(folderId);
      setPage(1);
      setColumnFilters([]);
      setDebouncedSearch("");
      setSearchResetKey((token) => token + 1);
      setFolderSearch("");
      setFolderSearchSeedValue("");
      setFolderSearchResetKey((token) => token + 1);
    },
    [],
  );

  const resetFolderSearch = useCallback(() => {
    setFolderSearch("");
    setFolderSearchSeedValue("");
    setFolderSearchResetKey((token) => token + 1);
  }, []);

  const handleSelectCatalog = useCallback(
    (catalogId: string) => {
      setSelectedCatalogId(catalogId);
      setSelectedFolderId("");
      setColumnFilters([]);
      setPage(1);
      resetFolderSearch();
    },
    [resetFolderSearch],
  );

  const handleSelectFolder = useCallback(
    (folderId: string) => {
      setSelectedFolderId(folderId);
      setColumnFilters([]);
      setPage(1);
      resetFolderSearch();
    },
    [resetFolderSearch],
  );

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  const handleFolderSearchChange = useCallback((value: string) => {
    setFolderSearch(value);
    setPage(1);
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

    setEditingProduct(null);
    setIsProductFormOpen(true);
  }, [activeCatalogId, activeFolderId, isLoadingProducts, productTable]);

  const handleEditProduct = useCallback((product: ProductTableItem) => {
    setProductActionError(null);
    setEditingProduct(product);
    setIsProductFormOpen(true);
  }, []);

  const handleDeleteProduct = useCallback((product: ProductTableItem) => {
    setProductActionError(null);
    setDeleteProductTarget(product);
  }, []);

  const handleConfirmDeleteProduct = useCallback(async () => {
    if (!deleteProductTarget) {
      return;
    }

    setIsProductActionBusy(true);
    setProductActionError(null);

    try {
      const result = await deleteProductAction({ productId: deleteProductTarget.id });
      if (!result.success) {
        setProductActionError(result.error);
        return;
      }

      setDeleteProductTarget(null);
      invalidateCatalogQueries();
    } finally {
      setIsProductActionBusy(false);
    }
  }, [deleteProductTarget, invalidateCatalogQueries]);

  const handleImportPublished = useCallback(() => {
    invalidateCatalogQueries();
  }, [invalidateCatalogQueries]);

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
      invalidateCatalogQueries();
      router.refresh();
    } finally {
      setIsFolderActionBusy(false);
    }
  }, [activeCatalogId, createFolderNameDraft, invalidateCatalogQueries, router]);

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
      invalidateCatalogQueries();
      router.refresh();
    } finally {
      setIsFolderActionBusy(false);
    }
  }, [
    activeCatalogId,
    deleteFolderTarget,
    folders,
    invalidateCatalogQueries,
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
      invalidateCatalogQueries();
      router.refresh();
    } finally {
      setIsFolderActionBusy(false);
    }
  }, [editFolderNameDraft, editFolderTarget, invalidateCatalogQueries, router]);

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
  const activeFolderName =
    folders.find((folder) => folder.id === activeFolderId)?.name ?? "";

  return (
    <>
      <div className={styles.page}>
        <div className={styles.body}>
          <CatalogPageIntro
            onDebouncedSearchChange={handleDebouncedSearchChange}
            searchResetKey={searchResetKey}
            searchResults={globalSearchQuery.data ?? null}
            isSearchLoading={globalSearchQuery.isFetching}
            searchError={globalSearchError}
            onSelectSearchProductFolder={handleSelectProductFolderSearchResult}
            onSelectSearchFolder={handleSelectFolderSearchResult}
            onImportExcelClick={isAdmin ? handleImportExcelClick : undefined}
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
              onEditCatalog={isAdmin ? handleEditCatalog : undefined}
              onDeleteCatalog={isAdmin ? handleDeleteCatalog : undefined}
              onEditFolder={isAdmin ? handleEditFolder : undefined}
              onDeleteFolder={isAdmin ? handleDeleteFolder : undefined}
              onAddCatalog={isAdmin ? handleAddCatalog : undefined}
              onAddFolder={isAdmin ? handleAddFolder : undefined}
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

          <ProductTable
            data={tableData}
            isLoading={isLoadingProducts || isLoadingFolders}
            error={productsError}
            onPageChange={handlePageChange}
            enableColumnFilters={enableColumnFilters}
            columnFilters={columnFilters}
            onColumnFilterChange={handleColumnFilterChange}
            onClearColumnFilters={handleClearColumnFilters}
            isAdmin={isAdmin}
            canEdit={canEdit}
            onColumnsChanged={isAdmin ? handleColumnsChanged : undefined}
            onEditProduct={canEdit ? handleEditProduct : undefined}
            onDeleteProduct={canEdit ? handleDeleteProduct : undefined}
            folderName={activeFolderName}
            folderSearchQuery={folderSearch}
            onFolderSearchChange={
              activeFolderId ? handleFolderSearchChange : undefined
            }
            folderSearchResetKey={folderSearchResetKey}
            folderSearchSeedValue={folderSearchSeedValue}
          />
      </div>
      </div>
      {importWizard}
      {isProductFormOpen && productTable ? (
        <LazyProductFormModal
          key={editingProduct?.id ?? "create"}
          folderId={productTable.folder.id}
          folderName={productTable.folder.name}
          columns={productTable.columns}
          product={editingProduct}
          onClose={() => {
            setIsProductFormOpen(false);
            setEditingProduct(null);
          }}
          onSaved={() => {
            const wasCreating = editingProduct === null;
            invalidateCatalogQueries();
            if (wasCreating) {
              setPage(1);
            }
          }}
        />
      ) : null}
      {deleteProductTarget && productTable ? (
        <ConfirmDialog
          title="¿Desea eliminar el siguiente producto?"
          message="Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          variant="danger"
          isBusy={isProductActionBusy}
          onConfirm={() => void handleConfirmDeleteProduct()}
          onCancel={() => {
            if (!isProductActionBusy) {
              setDeleteProductTarget(null);
            }
          }}
        >
          <div className={styles.confirmProductPreview}>
            <table className={styles.confirmProductPreviewTable}>
              <thead>
                <tr>
                  {deleteProductPreviewColumns.map((column) => (
                    <th key={column.id} scope="col">
                      {formatDeleteProductPreviewHeader(column.displayName)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {deleteProductPreviewColumns.map((column) => (
                    <td key={column.id}>
                      {formatDeleteProductPreviewValue(deleteProductTarget, column)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </ConfirmDialog>
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
