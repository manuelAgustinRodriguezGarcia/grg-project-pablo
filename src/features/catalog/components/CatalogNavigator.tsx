"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CatalogFolderSelectors } from "@/features/catalog/components/CatalogFolderSelectors";
import {
  CatalogPageIntro,
  CatalogPageTopBar,
} from "@/features/catalog/components/CatalogPageChrome";
import { ProductTable } from "@/features/catalog/components/ProductTable";
import type {
  CatalogNavigationFolderItem,
  DirectoryCatalogItem,
} from "@/features/catalog/types/catalog-navigator.types";
import type { CatalogNavigationResponse } from "@/features/catalog/types/navigation.types";
import type { ProductTableResponse } from "@/features/catalog/types/product-table.types";
import { sortByName } from "@/features/catalog/utils/sortByName";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const PAGE_SIZE = 25;

type CatalogNavigatorProps = {
  catalogs: DirectoryCatalogItem[];
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

export function CatalogNavigator({ catalogs }: CatalogNavigatorProps) {
  const sortedCatalogs = useMemo(() => sortByName(catalogs), [catalogs]);

  const [selectedCatalogId, setSelectedCatalogId] = useState(() =>
    getInitialCatalogId(catalogs),
  );
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [folders, setFolders] = useState<CatalogNavigationFolderItem[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  const [productTable, setProductTable] = useState<ProductTableResponse | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const activeCatalogId = useMemo(
    () => resolveCatalogId(sortedCatalogs, selectedCatalogId),
    [sortedCatalogs, selectedCatalogId],
  );

  const activeFolderId = useMemo(
    () => resolveFolderId(folders, selectedFolderId),
    [folders, selectedFolderId],
  );

  useEffect(() => {
    if (!activeCatalogId) {
      return;
    }

    let cancelled = false;

    async function loadFolders() {
      setIsLoadingFolders(true);
      setFoldersError(null);

      try {
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

        if (cancelled) {
          return;
        }

        setFolders(sortByName(data.folders));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setFolders([]);
        setFoldersError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las carpetas.",
        );
      } finally {
        if (!cancelled) {
          setIsLoadingFolders(false);
        }
      }
    }

    void loadFolders();

    return () => {
      cancelled = true;
    };
  }, [activeCatalogId]);

  useEffect(() => {
    if (!activeFolderId) {
      return;
    }

    let cancelled = false;

    async function loadProducts() {
      setIsLoadingProducts(true);
      setProductsError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });

        const response = await fetch(
          `/api/admin/folders/${activeFolderId}/products?${params.toString()}`,
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error ?? "No se pudieron cargar los productos.");
        }

        const data = (await response.json()) as ProductTableResponse;

        if (!cancelled) {
          setProductTable(data);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setProductTable(null);
        setProductsError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los productos.",
        );
      } finally {
        if (!cancelled) {
          setIsLoadingProducts(false);
        }
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, [activeFolderId, page]);

  const handleSelectCatalog = useCallback((catalogId: string) => {
    setSelectedCatalogId(catalogId);
    setSelectedFolderId("");
    setProductTable(null);
    setPage(1);
  }, []);

  const handleSelectFolder = useCallback((folderId: string) => {
    setSelectedFolderId(folderId);
    setProductTable(null);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  const visibleFolders = activeCatalogId ? folders : [];
  const tableData = activeFolderId ? productTable : null;

  if (sortedCatalogs.length === 0) {
    return (
      <div className={styles.page}>
        <CatalogPageTopBar />
        <div className={styles.body}>
          <CatalogPageIntro />
          <p className={styles.emptyState}>No hay catálogos activos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <CatalogPageTopBar />

      <div className={styles.body}>
        <CatalogPageIntro />

        {foldersError ? <p className={styles.inlineError}>{foldersError}</p> : null}

        <CatalogFolderSelectors
          catalogs={sortedCatalogs}
          folders={visibleFolders}
          selectedCatalogId={activeCatalogId}
          selectedFolderId={activeFolderId}
          isLoadingFolders={isLoadingFolders}
          onSelectCatalog={handleSelectCatalog}
          onSelectFolder={handleSelectFolder}
        />

        <ProductTable
          data={tableData}
          isLoading={isLoadingProducts || isLoadingFolders}
          error={productsError}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
