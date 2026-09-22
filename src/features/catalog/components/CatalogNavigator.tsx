"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAdminSectionTransition,
  useReportAdminSectionReady,
} from "@/features/admin/components/AdminSectionTransition";
import { adminQueryKeys } from "@/features/admin/query-keys";
import {
  createCatalogAction,
  deleteCatalogAction,
  updateCatalogAction,
} from "@/features/catalog/actions/catalog.actions";
import { deleteFolderAction } from "@/features/catalog/actions/folder.actions";
import { CatalogFolderSelectors } from "@/features/catalog/components/CatalogFolderSelectors";
import { CatalogPickerScreen } from "@/features/catalog/components/CatalogPickerScreen";
import { ChangeCoverImageModal } from "@/features/catalog/components/ChangeCoverImageModal";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import { CatalogPageIntro } from "@/features/catalog/components/CatalogPageChrome";
import { FolderPickerScreen } from "@/features/catalog/components/FolderPickerScreen";
import { LazyProductFormModal } from "@/features/catalog/components/LazyProductFormModal";
import { ProductTable } from "@/features/catalog/components/ProductTable";
import { LazyImportWizard } from "@/features/imports/components/LazyImportWizard";
import type { ImportDirectoryChange } from "@/features/imports/components/ImportWizard";
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
import {
  resolveActiveFolderId,
  resolveCatalogView,
  type CatalogView,
} from "@/features/catalog/utils/catalog-view";
import { useReplaceSearchParams } from "@/shared/hooks/useReplaceSearchParams";
import { normalizeMultilineText } from "@/shared/text/normalize-multiline-text";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const PAGE_SIZE = 100;
const MIN_GLOBAL_SEARCH_CHARS = 2;
const GLOBAL_SEARCH_DROPDOWN_PAGE_SIZE = 8;
const DELETE_PRODUCT_PREVIEW_COLUMN_COUNT = 3;

async function fetchFolderProductsPage(
  folderId: string,
  page: number,
  options: {
    pageSize?: number;
    filters?: ColumnFilterInput[];
    search?: string;
  } = {},
): Promise<ProductTableResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(options.pageSize ?? PAGE_SIZE),
    includeFullUrls: "false",
  });

  if (options.filters && options.filters.length > 0) {
    params.set("filters", JSON.stringify(options.filters));
  }

  if (options.search) {
    params.set("q", options.search);
  }

  const response = await fetch(
    `/api/admin/folders/${folderId}/products?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "No se pudieron cargar los productos.");
  }

  return (await response.json()) as ProductTableResponse;
}

async function locateProductPage(
  folderId: string,
  productId: string,
  options: {
    pageSize?: number;
    serializedFilters?: string;
  } = {},
): Promise<number | null> {
  const params = new URLSearchParams({
    productId,
    pageSize: String(options.pageSize ?? PAGE_SIZE),
  });

  if (options.serializedFilters) {
    params.set("filters", options.serializedFilters);
  }

  const response = await fetch(
    `/api/admin/folders/${folderId}/products/locate?${params.toString()}`,
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { page?: number };
  return typeof payload.page === "number" && payload.page >= 1
    ? payload.page
    : null;
}

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

function patchProductInTableCaches(
  queryClient: QueryClient,
  folderId: string,
  savedProduct: ProductTableItem,
  options?: { prependIfMissing?: boolean },
) {
  queryClient.setQueriesData<ProductTableResponse>(
    { queryKey: adminQueryKeys.products(folderId) },
    (current) => {
      if (!current) {
        return current;
      }

      const existingIndex = current.products.findIndex(
        (product) => product.id === savedProduct.id,
      );

      if (existingIndex >= 0) {
        const products = current.products.slice();
        products[existingIndex] = {
          ...products[existingIndex],
          ...savedProduct,
        };
        return { ...current, products };
      }

      if (!options?.prependIfMissing) {
        return current;
      }

      return {
        ...current,
        products: [savedProduct, ...current.products],
        pagination: {
          ...current.pagination,
          total: current.pagination.total + 1,
        },
      };
    },
  );
}

function toDirectoryCatalogItem(
  catalog: CatalogListItem,
  previous?: DirectoryCatalogItem | null,
): DirectoryCatalogItem {
  const sections = previous?.sections ?? [];
  return {
    id: catalog.id,
    name: catalog.name,
    description: catalog.description,
    coverImageUrl: previous?.coverImageUrl ?? null,
    sectionCount: catalog.folderCount,
    sectionNames: sections.map((section) => section.name),
    sections,
    updatedAt: catalog.updatedAt,
    order: catalog.order,
    offlineSync: previous?.offlineSync ?? { status: "unavailable" },
  };
}

function toLiteNavigationFolders(
  sections: DirectoryCatalogItem["sections"],
): CatalogNavigationFolderItem[] {
  return sortByName(
    sections.map((section) => ({
      id: section.id,
      name: section.name,
      description: null,
      coverImageUrl: null,
      order: 0,
      visibleToNormalUser: true,
      productCount: 0,
      updatedAt: "",
    })),
  );
}

function withCatalogSections(
  catalog: DirectoryCatalogItem,
  sections: DirectoryCatalogItem["sections"],
): DirectoryCatalogItem {
  const sorted = sortByName(sections);
  return {
    ...catalog,
    sections: sorted,
    sectionCount: sorted.length,
    sectionNames: sorted.map((section) => section.name),
  };
}

function toNavigationFolderItem(
  folder: FolderListItem,
  previous?: CatalogNavigationFolderItem | null,
): CatalogNavigationFolderItem {
  return {
    id: folder.id,
    name: folder.name,
    description: folder.description,
    coverImageUrl: previous?.coverImageUrl ?? null,
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

function resolveCatalogId(
  catalogs: DirectoryCatalogItem[],
  selectedCatalogId: string,
): string {
  if (catalogs.length === 0) {
    return "";
  }

  const exists = catalogs.some((catalog) => catalog.id === selectedCatalogId);
  return exists ? selectedCatalogId : "";
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
  const stableTableDataRef = useRef<ProductTableResponse | null>(null);
  const pinnedLocatePagesRef = useRef(new Map<string, number>());
  const pinnedLocateInflightRef = useRef(
    new Map<string, Promise<number | null>>(),
  );
  const [catalogList, setCatalogList] = useState(catalogs);
  const [prevCatalogs, setPrevCatalogs] = useState(catalogs);

  if (catalogs !== prevCatalogs) {
    setPrevCatalogs(catalogs);
    setCatalogList((current) => {
      const serverIds = new Set(catalogs.map((catalog) => catalog.id));
      const localOnly = current.filter((catalog) => !serverIds.has(catalog.id));
      if (localOnly.length === 0) {
        return catalogs;
      }
      // Keep optimistic creates until the refreshed server list includes them.
      return sortByName([...catalogs, ...localOnly]);
    });
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
  const [preferProductsShell, setPreferProductsShell] = useState(
    () => Boolean(initialCatalogId && initialFolderId),
  );
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(
    null,
  );

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
  const [isFolderActionBusy, setIsFolderActionBusy] = useState(false);
  const [folderActionError, setFolderActionError] = useState<string | null>(null);

  const [deleteFolderTarget, setDeleteFolderTarget] = useState<CatalogTarget | null>(null);
  const [editFolderTarget, setEditFolderTarget] = useState<CatalogTarget | null>(null);

  const activeCatalogId = useMemo(
    () => resolveCatalogId(sortedCatalogs, selectedCatalogId),
    [sortedCatalogs, selectedCatalogId],
  );

  const invalidateCatalogQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: adminQueryKeys.navigation(activeCatalogId) });
    void queryClient.invalidateQueries({ queryKey: adminQueryKeys.products() });
  }, [activeCatalogId, queryClient]);

  const bumpFolderProductCount = useCallback(
    (folderId: string, delta: number) => {
      if (!activeCatalogId || !folderId || delta === 0) {
        return;
      }

      const currentFolders =
        queryClient.getQueryData<CatalogNavigationFolderItem[]>(
          adminQueryKeys.navigation(activeCatalogId),
        ) ?? [];

      if (currentFolders.length === 0) {
        return;
      }

      queryClient.setQueryData(
        adminQueryKeys.navigation(activeCatalogId),
        currentFolders.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                productCount: Math.max(0, folder.productCount + delta),
              }
            : folder,
        ),
      );
    },
    [activeCatalogId, queryClient],
  );

  const handleDirectoryChanged = useCallback(
    (change: ImportDirectoryChange) => {
      switch (change.type) {
        case "catalog-created": {
          setCatalogList((current) => sortByName([...current, change.catalog]));
          queryClient.setQueryData(adminQueryKeys.navigation(change.catalog.id), []);
          void queryClient.cancelQueries({
            queryKey: adminQueryKeys.navigation(change.catalog.id),
          });
          break;
        }
        case "catalog-updated": {
          setCatalogList((current) =>
            sortByName(
              current.map((catalog) =>
                catalog.id === change.catalog.id ? change.catalog : catalog,
              ),
            ),
          );
          break;
        }
        case "catalog-deleted": {
          setCatalogList((current) =>
            current.filter((catalog) => catalog.id !== change.catalogId),
          );
          void queryClient.removeQueries({
            queryKey: adminQueryKeys.navigation(change.catalogId),
          });
          if (selectedCatalogId === change.catalogId) {
            setSelectedCatalogId("");
            setSelectedFolderId("");
          }
          break;
        }
        case "folder-created": {
          const currentFolders = queryClient.getQueryData<CatalogNavigationFolderItem[]>(
            adminQueryKeys.navigation(change.catalogId),
          );
          if (currentFolders) {
            queryClient.setQueryData(
              adminQueryKeys.navigation(change.catalogId),
              sortByName([
                ...currentFolders.filter((folder) => folder.id !== change.folder.id),
                change.folder,
              ]),
            );
          } else {
            void queryClient.invalidateQueries({
              queryKey: adminQueryKeys.navigation(change.catalogId),
            });
          }
          setCatalogList((current) =>
            current.map((catalog) =>
              catalog.id === change.catalogId
                ? withCatalogSections(catalog, [
                    ...catalog.sections.filter(
                      (section) => section.id !== change.folder.id,
                    ),
                    { id: change.folder.id, name: change.folder.name },
                  ])
                : catalog,
            ),
          );
          break;
        }
        case "folder-updated": {
          const currentFolders = queryClient.getQueryData<CatalogNavigationFolderItem[]>(
            adminQueryKeys.navigation(change.catalogId),
          );
          if (currentFolders) {
            queryClient.setQueryData(
              adminQueryKeys.navigation(change.catalogId),
              sortByName(
                currentFolders.map((folder) =>
                  folder.id === change.folder.id ? change.folder : folder,
                ),
              ),
            );
          } else {
            void queryClient.invalidateQueries({
              queryKey: adminQueryKeys.navigation(change.catalogId),
            });
          }
          setCatalogList((current) =>
            current.map((catalog) => {
              if (catalog.id !== change.catalogId) {
                return catalog;
              }

              const hasSection = catalog.sections.some(
                (section) => section.id === change.folder.id,
              );
              const nextSections = hasSection
                ? catalog.sections.map((section) =>
                    section.id === change.folder.id
                      ? { id: section.id, name: change.folder.name }
                      : section,
                  )
                : [
                    ...catalog.sections,
                    { id: change.folder.id, name: change.folder.name },
                  ];

              return withCatalogSections(catalog, nextSections);
            }),
          );
          break;
        }
        case "folder-deleted": {
          const currentFolders = queryClient.getQueryData<CatalogNavigationFolderItem[]>(
            adminQueryKeys.navigation(change.catalogId),
          );
          if (currentFolders) {
            queryClient.setQueryData(
              adminQueryKeys.navigation(change.catalogId),
              currentFolders.filter((folder) => folder.id !== change.folderId),
            );
          } else {
            void queryClient.invalidateQueries({
              queryKey: adminQueryKeys.navigation(change.catalogId),
            });
          }
          setCatalogList((current) =>
            current.map((catalog) =>
              catalog.id === change.catalogId
                ? withCatalogSections(
                    catalog,
                    catalog.sections.filter(
                      (section) => section.id !== change.folderId,
                    ),
                  )
                : catalog,
            ),
          );
          if (selectedFolderId === change.folderId) {
            setSelectedFolderId("");
          }
          break;
        }
        default: {
          const _exhaustive: never = change;
          void _exhaustive;
          break;
        }
      }

      router.refresh();
    },
    [queryClient, router, selectedCatalogId, selectedFolderId],
  );

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

  const directoryFolders = useMemo(() => {
    const catalog = catalogList.find((item) => item.id === activeCatalogId);
    return toLiteNavigationFolders(catalog?.sections ?? []);
  }, [activeCatalogId, catalogList]);

  const folders = useMemo(() => {
    if (
      activeCatalogId &&
      !navigationQuery.isPlaceholderData &&
      navigationQuery.data
    ) {
      return navigationQuery.data;
    }
    return directoryFolders;
  }, [
    activeCatalogId,
    directoryFolders,
    navigationQuery.data,
    navigationQuery.isPlaceholderData,
  ]);

  const isNavigationReady = Boolean(activeCatalogId);
  const isLoadingFolders = false;
  const foldersError =
    navigationQuery.error instanceof Error ? navigationQuery.error.message : null;

  const activeFolderId = useMemo(
    () =>
      resolveActiveFolderId({
        activeCatalogId,
        selectedFolderId,
        isNavigationReady,
        folderIds: folders.map((folder) => folder.id),
      }),
    [activeCatalogId, folders, isNavigationReady, selectedFolderId],
  );

  useEffect(() => {
    pinnedLocatePagesRef.current.clear();
    pinnedLocateInflightRef.current.clear();
  }, [activeFolderId]);

  const catalogView: CatalogView = useMemo(
    () =>
      resolveCatalogView({
        activeCatalogId,
        activeFolderId,
        preferProductsShell,
      }),
    [activeCatalogId, activeFolderId, preferProductsShell],
  );

  const canLoadFolderProducts =
    Boolean(activeFolderId) &&
    folders.some((folder) => folder.id === activeFolderId);

  useEffect(() => {
    if (!activeCatalogId) {
      replaceParams({ catalog: null, folder: null });
      return;
    }

    replaceParams({
      catalog: activeCatalogId,
      folder: activeFolderId || null,
    });
  }, [
    activeCatalogId,
    activeFolderId,
    replaceParams,
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
    queryFn: (): Promise<ProductTableResponse> =>
      fetchFolderProductsPage(activeFolderId, page, {
        pageSize: PAGE_SIZE,
        filters:
          enableColumnFilters && columnFilters.length > 0
            ? columnFilters
            : undefined,
        search: folderSearch || undefined,
      }),
    enabled: canLoadFolderProducts,
    placeholderData: keepPreviousData,
    staleTime: 0,
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

  const holdPreviousProducts =
    preferProductsShell &&
    Boolean(activeCatalogId) &&
    !activeFolderId &&
    folders.length > 0;

  if (canLoadFolderProducts && productTable) {
    stableTableDataRef.current = productTable;
  } else if (
    !holdPreviousProducts &&
    isNavigationReady &&
    !canLoadFolderProducts
  ) {
    stableTableDataRef.current = null;
  }

  const tableData =
    canLoadFolderProducts && productTable
      ? productTable
      : holdPreviousProducts
        ? stableTableDataRef.current
        : isNavigationReady && !canLoadFolderProducts
          ? null
          : (stableTableDataRef.current ?? null);

  const catalogHasNoFolders =
    Boolean(activeCatalogId) && isNavigationReady && folders.length === 0;

  const isFolderContextLoading =
    (Boolean(activeFolderId) && !canLoadFolderProducts) ||
    (Boolean(activeFolderId) &&
      tableData !== null &&
      tableData.folder.id !== activeFolderId);

  const isInitialTableLoading =
    Boolean(activeFolderId) &&
    tableData === null &&
    (productsQuery.isFetching || !canLoadFolderProducts);

  const isTableRefreshing = tableData !== null && isFolderContextLoading;

  const isFilterRefreshing =
    tableData !== null &&
    !isFolderContextLoading &&
    productsQuery.isFetching &&
    productsQuery.isPlaceholderData &&
    Boolean(activeFolderId) &&
    tableData.folder.id === activeFolderId;

  const sectionTransition = useAdminSectionTransition();
  const hideInternalLoaders = sectionTransition?.isCoveringContent ?? false;

  const isSectionContentReady =
    Boolean(foldersError || productsError) ||
    !activeCatalogId ||
    (isNavigationReady &&
      (holdPreviousProducts
        ? tableData !== null
        : !activeFolderId ||
          (tableData !== null &&
            tableData.folder.id === activeFolderId &&
            !isFolderContextLoading)));

  useReportAdminSectionReady(isSectionContentReady);

  const handleColumnsChanged = useCallback(async () => {
    if (!activeFolderId) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.products(activeFolderId),
      refetchType: "active",
    });
  }, [activeFolderId, queryClient]);

  const globalSearchError =
    globalSearchQuery.error instanceof Error ? globalSearchQuery.error.message : null;

  const handleSelectProductFolderSearchResult = useCallback(
    (group: ProductFolderSearchGroup) => {
      const seed = debouncedSearch.trim();
      setPreferProductsShell(true);
      setHighlightedProductId(group.items[0]?.productId ?? null);
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
      setPreferProductsShell(true);
      setHighlightedProductId(null);
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
      setPreferProductsShell((current) => current || Boolean(selectedCatalogId));
      setHighlightedProductId(null);
      setSelectedCatalogId(catalogId);
      setSelectedFolderId("");
      setColumnFilters([]);
      setPage(1);
      resetFolderSearch();
    },
    [resetFolderSearch, selectedCatalogId],
  );

  const handleSelectFolder = useCallback(
    (folderId: string) => {
      setPreferProductsShell(true);
      setHighlightedProductId(null);
      setSelectedFolderId(folderId);
      setColumnFilters([]);
      setPage(1);
      resetFolderSearch();
    },
    [resetFolderSearch],
  );

  const handleBackToCatalogs = useCallback(() => {
    setPreferProductsShell(false);
    setHighlightedProductId(null);
    setSelectedCatalogId("");
    setSelectedFolderId("");
    setColumnFilters([]);
    setPage(1);
    resetFolderSearch();
    setDebouncedSearch("");
    setSearchResetKey((token) => token + 1);
  }, [resetFolderSearch]);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  const handleRevealPinnedProduct = useCallback(
    (productId: string) => {
      if (!activeFolderId || !productId) {
        return;
      }

      const cacheKey = `${activeFolderId}:${serializedColumnFilters}:${productId}`;
      const cachedPage = pinnedLocatePagesRef.current.get(cacheKey);
      if (cachedPage != null) {
        setPage(cachedPage);
        return;
      }

      let inflight = pinnedLocateInflightRef.current.get(cacheKey);
      if (!inflight) {
        inflight = locateProductPage(activeFolderId, productId, {
          pageSize: PAGE_SIZE,
          serializedFilters: serializedColumnFilters || undefined,
        })
          .then((locatedPage) => {
            if (locatedPage != null) {
              pinnedLocatePagesRef.current.set(cacheKey, locatedPage);
            }
            return locatedPage;
          })
          .finally(() => {
            pinnedLocateInflightRef.current.delete(cacheKey);
          });
        pinnedLocateInflightRef.current.set(cacheKey, inflight);
      }

      void inflight.then((locatedPage) => {
        if (locatedPage != null) {
          setPage(locatedPage);
        }
      });
    },
    [activeFolderId, serializedColumnFilters],
  );

  const handlePrefetchPinnedProduct = useCallback(
    (productId: string) => {
      if (!activeFolderId || !productId) {
        return;
      }

      const cacheKey = `${activeFolderId}:${serializedColumnFilters}:${productId}`;
      const filtersForFetch =
        enableColumnFilters && columnFilters.length > 0
          ? columnFilters
          : undefined;

      void (async () => {
        try {
          let locatedPage = pinnedLocatePagesRef.current.get(cacheKey) ?? null;

          if (locatedPage == null) {
            let inflight = pinnedLocateInflightRef.current.get(cacheKey);
            if (!inflight) {
              inflight = locateProductPage(activeFolderId, productId, {
                pageSize: PAGE_SIZE,
                serializedFilters: serializedColumnFilters || undefined,
              })
                .then((page) => {
                  if (page != null) {
                    pinnedLocatePagesRef.current.set(cacheKey, page);
                  }
                  return page;
                })
                .finally(() => {
                  pinnedLocateInflightRef.current.delete(cacheKey);
                });
              pinnedLocateInflightRef.current.set(cacheKey, inflight);
            }

            locatedPage = await inflight;
            if (locatedPage == null) {
              return;
            }
          }

          await queryClient.prefetchQuery({
            queryKey: adminQueryKeys.products(
              activeFolderId,
              locatedPage,
              serializedColumnFilters,
              "",
            ),
            queryFn: () =>
              fetchFolderProductsPage(activeFolderId, locatedPage, {
                pageSize: PAGE_SIZE,
                filters: filtersForFetch,
              }),
          });
        } catch {
          return;
        }
      })();
    },
    [
      activeFolderId,
      columnFilters,
      enableColumnFilters,
      queryClient,
      serializedColumnFilters,
    ],
  );

  const handleFolderSearchChange = useCallback((value: string) => {
    setFolderSearch(value);
    if (value.trim()) {
      setPage(1);
    }
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
      setProductActionError("Seleccione un catálogo para agregar productos.");
      return;
    }

    if (!activeFolderId) {
      setProductActionError("Seleccione una carpeta para agregar productos.");
      return;
    }

    if (isLoadingProducts || !productTable) {
      setProductActionError("Espere a que carguen los datos de la carpeta seleccionada.");
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
      bumpFolderProductCount(activeFolderId, -1);
      invalidateCatalogQueries();
    } finally {
      setIsProductActionBusy(false);
    }
  }, [activeFolderId, bumpFolderProductCount, deleteProductTarget, invalidateCatalogQueries]);

  const handleImportPublished = useCallback(() => {
    invalidateCatalogQueries();
    router.refresh();
  }, [invalidateCatalogQueries, router]);

  const handleAddCatalog = useCallback(() => {
    setCatalogActionError(null);
    setCreateCatalogNameDraft("");
    setIsCreateCatalogOpen(true);
  }, []);

  const handleAddFolder = useCallback(() => {
    setFolderActionError(null);
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
      // Seed empty navigation so the folder dropdown is ready without waiting
      // for the first network fetch of the new catalog.
      queryClient.setQueryData(adminQueryKeys.navigation(created.id), []);
      void queryClient.cancelQueries({
        queryKey: adminQueryKeys.navigation(created.id),
      });
      setSelectedCatalogId(created.id);
      setSelectedFolderId("");
      setPage(1);
      setIsCreateCatalogOpen(false);
      setCreateCatalogNameDraft("");
      router.refresh();
    } finally {
      setIsCatalogActionBusy(false);
    }
  }, [createCatalogNameDraft, queryClient, router]);

  const handleFolderCreateSaved = useCallback(
    async (payload: { name: string; folderId: string }) => {
      if (!activeCatalogId) {
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: adminQueryKeys.navigation(activeCatalogId),
      });

      setCatalogList((current) =>
        current.map((catalog) =>
          catalog.id === activeCatalogId
            ? withCatalogSections(catalog, [
                ...catalog.sections.filter(
                  (section) => section.id !== payload.folderId,
                ),
                { id: payload.folderId, name: payload.name },
              ])
            : catalog,
        ),
      );
      setSelectedFolderId(payload.folderId);
      setPage(1);
      setIsCreateFolderOpen(false);
      router.refresh();
    },
    [activeCatalogId, queryClient, router],
  );

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

      if (activeCatalogId) {
        queryClient.setQueryData(
          adminQueryKeys.navigation(activeCatalogId),
          nextFolders,
        );
      }

      setCatalogList((current) =>
        current.map((catalog) =>
          catalog.id === activeCatalogId
            ? withCatalogSections(
                catalog,
                catalog.sections.filter(
                  (section) => section.id !== deleteFolderTarget.id,
                ),
              )
            : catalog,
        ),
      );

      if (selectedFolderId === deleteFolderTarget.id) {
        setSelectedFolderId("");
        setPage(1);
        stableTableDataRef.current = null;
        void queryClient.removeQueries({
          queryKey: adminQueryKeys.products(deleteFolderTarget.id),
        });
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
    queryClient,
    router,
    selectedFolderId,
  ]);

  const handleFolderEditSaved = useCallback(
    async (payload: { previousName: string; name: string }) => {
      if (activeCatalogId) {
        await queryClient.invalidateQueries({
          queryKey: adminQueryKeys.navigation(activeCatalogId),
        });
      }

      if (payload.previousName !== payload.name) {
        setCatalogList((current) =>
          current.map((catalog) => {
            if (catalog.id !== activeCatalogId) {
              return catalog;
            }

            return withCatalogSections(
              catalog,
              catalog.sections.map((section) =>
                section.name === payload.previousName
                  ? { ...section, name: payload.name }
                  : section,
              ),
            );
          }),
        );
      }

      setEditFolderTarget(null);
      router.refresh();
    },
    [activeCatalogId, queryClient, router],
  );

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
        setSelectedCatalogId("");
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

      const previous = catalogList.find((catalog) => catalog.id === result.data.id);
      const updated = toDirectoryCatalogItem(result.data, previous);
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
  }, [catalogList, editCatalogNameDraft, editCatalogTarget, router]);

  const editNameUnchanged =
    editCatalogTarget !== null &&
    editCatalogNameDraft.trim() === editCatalogTarget.name.trim();
  const editNameEmpty = editCatalogNameDraft.trim().length === 0;

  const createCatalogNameEmpty = createCatalogNameDraft.trim().length === 0;

  const importWizard = isImportOpen ? (
    <LazyImportWizard
      catalogs={sortedCatalogs}
      initialCatalogId={activeCatalogId}
      initialFolderId={activeFolderId}
      onClose={() => setIsImportOpen(false)}
      onPublished={handleImportPublished}
      onDirectoryChanged={handleDirectoryChanged}
    />
  ) : null;

  const visibleFolders = activeCatalogId ? folders : [];
  const activeFolderName =
    folders.find((folder) => folder.id === activeFolderId)?.name ?? "";
  const activeCatalogName =
    sortedCatalogs.find((catalog) => catalog.id === activeCatalogId)?.name ?? "";
  const activeCatalogSectionCount =
    sortedCatalogs.find((catalog) => catalog.id === activeCatalogId)?.sectionCount ??
    0;
  const editFolderImageUrl =
    editFolderTarget
      ? folders.find((folder) => folder.id === editFolderTarget.id)?.coverImageUrl ??
        null
      : null;

  const handleEditFolderCover = useCallback(
    (folderId: string) => {
      handleEditFolder(folderId);
    },
    [handleEditFolder],
  );

  return (
    <>
      <div className={styles.page}>
        <div className={styles.body}>
          {catalogView === "catalog-picker" ? (
            <CatalogPickerScreen
              catalogs={sortedCatalogs}
              isAdmin={isAdmin}
              onSelectCatalog={handleSelectCatalog}
              onAddCatalog={isAdmin ? handleAddCatalog : undefined}
            />
          ) : null}

          {catalogView === "folder-picker" ? (
            <FolderPickerScreen
              catalogName={activeCatalogName}
              folders={visibleFolders}
              isLoading={isLoadingFolders}
              expectedFolderCount={activeCatalogSectionCount}
              isAdmin={isAdmin}
              error={foldersError}
              onBack={handleBackToCatalogs}
              onSelectFolder={handleSelectFolder}
              onEditFolder={isAdmin ? handleEditFolder : undefined}
              onDeleteFolder={isAdmin ? handleDeleteFolder : undefined}
              onAddFolder={isAdmin ? handleAddFolder : undefined}
              onEditFolderCover={isAdmin ? handleEditFolderCover : undefined}
            />
          ) : null}

          {catalogView === "products" ? (
            <>
              <CatalogPageIntro
                isAdmin={isAdmin}
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
                  onBackToCatalogs={handleBackToCatalogs}
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
                isLoading={
                  hideInternalLoaders
                    ? false
                    : isInitialTableLoading || isFolderContextLoading
                }
                isRefreshing={hideInternalLoaders ? false : isTableRefreshing}
                isFilterRefreshing={hideInternalLoaders ? false : isFilterRefreshing}
                error={productsError}
                emptyTitle={
                  catalogHasNoFolders
                    ? "Este catálogo no tiene carpetas"
                    : !activeCatalogId
                      ? "Seleccione un catálogo y una carpeta"
                      : "Seleccione una carpeta"
                }
                emptyDescription={
                  catalogHasNoFolders
                    ? "Cree una carpeta o importe un Excel para comenzar."
                    : null
                }
                onImportExcel={
                  isAdmin && catalogHasNoFolders ? handleImportExcelClick : undefined
                }
                onAddFolder={isAdmin && catalogHasNoFolders ? handleAddFolder : undefined}
                onPageChange={handlePageChange}
                page={page}
                enableColumnFilters={enableColumnFilters}
                columnFilters={columnFilters}
                onColumnFilterChange={handleColumnFilterChange}
                onClearColumnFilters={handleClearColumnFilters}
                isAdmin={isAdmin}
                canEdit={canEdit}
                onColumnsChanged={isAdmin ? handleColumnsChanged : undefined}
                onEditProduct={isAdmin ? handleEditProduct : undefined}
                onDeleteProduct={isAdmin ? handleDeleteProduct : undefined}
                folderId={
                  activeFolderId ||
                  (holdPreviousProducts ? tableData?.folder.id : undefined)
                }
                folderName={
                  activeFolderName ||
                  (holdPreviousProducts ? tableData?.folder.name ?? "" : "")
                }
                folderSearchQuery={folderSearch}
                onFolderSearchChange={
                  activeFolderId ? handleFolderSearchChange : undefined
                }
                folderSearchResetKey={folderSearchResetKey}
                folderSearchSeedValue={folderSearchSeedValue}
                highlightProductId={highlightedProductId}
                onRevealPinnedProduct={handleRevealPinnedProduct}
                onPrefetchPinnedProduct={handlePrefetchPinnedProduct}
              />
            </>
          ) : null}

          {catalogView !== "products" ? (
            <>
              {foldersError ? <p className={styles.inlineError}>{foldersError}</p> : null}
              {catalogActionError ? (
                <p className={styles.inlineError}>{catalogActionError}</p>
              ) : null}
              {folderActionError ? (
                <p className={styles.inlineError}>{folderActionError}</p>
              ) : null}
            </>
          ) : null}
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
          onSaved={(savedProduct) => {
            const wasCreating = editingProduct === null;
            const folderId = productTable.folder.id;

            patchProductInTableCaches(queryClient, folderId, savedProduct, {
              prependIfMissing: wasCreating,
            });

            if (wasCreating) {
              bumpFolderProductCount(folderId, 1);
              setPage(1);
            }

            // Background reconcile with server (images, generated codes, etc.)
            // without delaying the modal close / visible row update.
            void queryClient.refetchQueries({
              queryKey: adminQueryKeys.products(folderId),
              type: "active",
            });
            void queryClient.invalidateQueries({
              queryKey: adminQueryKeys.navigation(activeCatalogId),
            });
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
              ¿Confirma el cambio de nombre del catálogo{" "}
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
          message="Ingrese el nombre del catálogo que desea crear."
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
      {isCreateFolderOpen && activeCatalogId ? (
        <ChangeCoverImageModal
          createCatalogId={activeCatalogId}
          onClose={() => setIsCreateFolderOpen(false)}
          onSaved={handleFolderCreateSaved}
        />
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
        <ChangeCoverImageModal
          folderId={editFolderTarget.id}
          folderName={editFolderTarget.name}
          currentImageUrl={editFolderImageUrl}
          allowRename
          onClose={() => setEditFolderTarget(null)}
          onSaved={handleFolderEditSaved}
        />
      ) : null}
    </>
  );
}
