"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import catalogStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import {
  serializeColumnFilters,
  upsertColumnFilter,
} from "@/features/catalog/utils/column-filter-state";
import {
  createPriceListAction,
  deletePriceListAction,
  updatePriceListAction,
} from "@/features/prices/actions/price-list.actions";
import {
  LazyPriceItemFormModal,
  LazyPriceListFormModal,
  LazyPriceSupplierEditModal,
} from "@/features/prices/components/LazyPriceModals";
import { PriceItemTable } from "@/features/prices/components/PriceItemTable";
import type { PriceListFormValues } from "@/features/prices/components/PriceListFormModal";
import { PriceListSelectorPanel } from "@/features/prices/components/PriceListSelectorPanel";
import { PricePageChrome } from "@/features/prices/components/PricePageChrome";
import { PriceSupplierBanner } from "@/features/prices/components/PriceSupplierBanner";
import type { PriceSupplierEditValues } from "@/features/prices/components/PriceSupplierEditModal";
import { LazyImportWizard } from "@/features/imports/components/LazyImportWizard";
import type { PriceColumnListItem } from "@/features/prices/types/price-column.types";
import type { PriceItemTableResponse } from "@/features/prices/types/price-item-table.types";
import type { PriceItemTableRow } from "@/features/prices/types/price-item-table.types";
import type { PriceListListItem } from "@/features/prices/types/price-list.types";
import { sortByName } from "@/features/catalog/utils/sortByName";
import type { ColumnFilterInput } from "@/server/filters/column-filter.types";
import { FloatingToast } from "@/shared/components/FloatingToast";
import { useReplaceSearchParams } from "@/shared/hooks/useReplaceSearchParams";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

const PAGE_SIZE = 50;

type PriceNavigatorProps = {
  initialPriceLists: PriceListListItem[];
  initialListId?: string;
  isAdmin: boolean;
  loadError: string | null;
};

function getInitialListId(lists: PriceListListItem[]): string {
  return sortByName(lists)[0]?.id ?? "";
}

function resolveListId(lists: PriceListListItem[], selectedId: string): string {
  if (lists.length === 0) {
    return "";
  }

  return lists.some((list) => list.id === selectedId)
    ? selectedId
    : getInitialListId(lists);
}

export function PriceNavigator({
  initialPriceLists,
  initialListId = "",
  isAdmin,
  loadError,
}: PriceNavigatorProps) {
  const router = useRouter();
  const replaceParams = useReplaceSearchParams();
  const [priceLists, setPriceLists] = useState(initialPriceLists);
  const [prevInitialLists, setPrevInitialLists] = useState(initialPriceLists);

  if (initialPriceLists !== prevInitialLists) {
    setPrevInitialLists(initialPriceLists);
    setPriceLists(initialPriceLists);
  }

  const sortedLists = useMemo(() => sortByName(priceLists), [priceLists]);
  const [selectedListId, setSelectedListId] = useState(() =>
    resolveListId(initialPriceLists, initialListId),
  );

  const activeListId = useMemo(
    () => resolveListId(sortedLists, selectedListId),
    [sortedLists, selectedListId],
  );

  useEffect(() => {
    replaceParams({
      list: activeListId || null,
    });
  }, [activeListId, replaceParams]);

  const [page, setPage] = useState(1);
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFilterInput[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successToastKey, setSuccessToastKey] = useState(0);

  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [createListNameDraft, setCreateListNameDraft] = useState("");
  const [listFormMode, setListFormMode] = useState<"edit" | null>(null);
  const [editingList, setEditingList] = useState<PriceListListItem | null>(null);
  const [deleteListTarget, setDeleteListTarget] = useState<PriceListListItem | null>(
    null,
  );
  const [isListActionBusy, setIsListActionBusy] = useState(false);
  const [listActionError, setListActionError] = useState<string | null>(null);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceItemTableRow | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<PriceItemTableRow | null>(null);
  const [isItemActionBusy, setIsItemActionBusy] = useState(false);
  const [itemsActionError, setItemsActionError] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSupplierEditOpen, setIsSupplierEditOpen] = useState(false);

  const queryClient = useQueryClient();

  const invalidatePriceQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: adminQueryKeys.priceColumns() });
    void queryClient.invalidateQueries({ queryKey: adminQueryKeys.priceItems() });
  }, [queryClient]);

  const notifySuccess = useCallback((message: string) => {
    setSuccessToastKey((current) => current + 1);
    setSuccessMessage(message);
  }, []);

  const dismissSuccessToast = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  const activeList = useMemo(
    () => sortedLists.find((list) => list.id === activeListId) ?? null,
    [activeListId, sortedLists],
  );

  const handleSubmitSupplierEdit = useCallback(
    async (values: PriceSupplierEditValues) => {
      if (!activeList) {
        return;
      }

      setIsListActionBusy(true);
      setListActionError(null);

      try {
        const result = await updatePriceListAction({
          id: activeList.id,
          supplierName: values.supplierName || null,
          supplierDate: values.supplierDate,
        });

        if (!result.success) {
          setListActionError(result.error);
          return;
        }

        setPriceLists((current) =>
          current.map((list) => (list.id === result.data.id ? result.data : list)),
        );
        setIsSupplierEditOpen(false);
        notifySuccess("Proveedor actualizado correctamente.");
        router.refresh();
      } finally {
        setIsListActionBusy(false);
      }
    },
    [activeList, notifySuccess, router],
  );

  const handleSearchSubmit = useCallback((query: string) => {
    setListSearchQuery(query);
    setPage(1);
  }, []);

  const serializedColumnFilters = useMemo(
    () => serializeColumnFilters(columnFilters),
    [columnFilters],
  );

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

  const columnsQuery = useQuery({
    queryKey: adminQueryKeys.priceColumns(activeListId),
    queryFn: async (): Promise<PriceColumnListItem[]> => {
      const response = await fetch(`/api/admin/price-lists/${activeListId}/columns`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "No se pudieron cargar las columnas.");
      }

      const columnsData = (await response.json()) as {
        columns: PriceColumnListItem[];
      };

      return columnsData.columns;
    },
    enabled: isAdmin && Boolean(activeListId),
    staleTime: 5 * 60 * 1000,
  });

  const itemsQuery = useQuery({
    queryKey: adminQueryKeys.priceItems(
      activeListId,
      page,
      listSearchQuery,
      serializedColumnFilters,
    ),
    queryFn: async ({ signal }): Promise<PriceItemTableResponse> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (listSearchQuery) {
        params.set("q", listSearchQuery);
      }

      if (columnFilters.length > 0) {
        params.set("filters", JSON.stringify(columnFilters));
      }

      const itemsResponse = await fetch(
        `/api/admin/price-lists/${activeListId}/items?${params.toString()}`,
        { signal },
      );

      if (!itemsResponse.ok) {
        const payload = (await itemsResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "No se pudieron cargar los ítems.");
      }

      return (await itemsResponse.json()) as PriceItemTableResponse;
    },
    enabled: Boolean(activeListId),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const itemTable = activeListId ? (itemsQuery.data ?? null) : null;
  const isLoadingItems = itemsQuery.isFetching;
  const itemsError =
    itemsQuery.error instanceof Error ? itemsQuery.error.message : null;

  const columnDetails = useMemo(() => {
    if (isAdmin && columnsQuery.data) {
      return columnsQuery.data;
    }

    return (itemsQuery.data?.columns ?? []).map((column) => ({
      id: column.id,
      priceListId: activeListId,
      originalName: column.originalName,
      displayName: column.displayName,
      internalKey: column.internalKey,
      dataType: column.dataType,
      order: 0,
      visibleToNormalUser: column.visibleToNormalUser,
      isSearchable: false,
      isFilterable: false,
      isAdminEditable: true,
      isReadOnly: false,
      isPrimaryCode: column.isPrimaryCode,
      isDescription: column.isDescription,
      isPrice: column.isPrice,
      helpText: null,
    }));
  }, [activeListId, columnsQuery.data, isAdmin, itemsQuery.data?.columns]);

  const handleSelectList = useCallback((listId: string) => {
    setSelectedListId(listId);
    setPage(1);
    setColumnFilters([]);
    setListSearchQuery("");
  }, []);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  const refreshListsFromServer = useCallback(async () => {
    const response = await fetch("/api/admin/price-lists");
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { priceLists: PriceListListItem[] };
    setPriceLists(payload.priceLists);
  }, []);

  const handleConfirmDeleteItem = useCallback(async () => {
    if (!deleteItemTarget || !activeListId) {
      return;
    }

    setIsItemActionBusy(true);
    try {
      const response = await fetch(
        `/api/admin/price-lists/${activeListId}/items/${deleteItemTarget.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setItemsActionError(payload?.error ?? "No se pudo eliminar el ítem.");
        return;
      }

      setDeleteItemTarget(null);
      invalidatePriceQueries();
      notifySuccess("Ítem eliminado correctamente.");
      void refreshListsFromServer();
    } finally {
      setIsItemActionBusy(false);
    }
  }, [activeListId, deleteItemTarget, invalidatePriceQueries, notifySuccess, refreshListsFromServer]);

  const handleImportExcelClick = useCallback(() => {
    setIsImportOpen(true);
  }, []);

  const handleImportPublished = useCallback(
    async (context?: { priceListId?: string }) => {
      invalidatePriceQueries();
      notifySuccess("Importación de precios completada.");

      const response = await fetch("/api/admin/price-lists");
      if (response.ok) {
        const payload = (await response.json()) as { priceLists: PriceListListItem[] };
        setPriceLists(payload.priceLists);

        if (context?.priceListId) {
          setSelectedListId(context.priceListId);
        } else if (!activeListId && payload.priceLists.length > 0) {
          setSelectedListId(getInitialListId(payload.priceLists));
        }
      }

      router.refresh();
    },
    [activeListId, invalidatePriceQueries, notifySuccess, router],
  );

  const handleSubmitListForm = useCallback(
    async (values: PriceListFormValues) => {
      if (!editingList) {
        return;
      }

      setIsListActionBusy(true);
      setListActionError(null);

      try {
        const result = await updatePriceListAction({
          id: editingList.id,
          name: values.name,
          visibleToNormalUser: values.visibleToNormalUser,
          supplierName: values.supplierName || null,
          supplierDate: values.supplierDate,
        });

        if (!result.success) {
          setListActionError(result.error);
          return;
        }

        setPriceLists((current) =>
          current.map((list) => (list.id === result.data.id ? result.data : list)),
        );
        setEditingList(null);
        setListFormMode(null);
        notifySuccess("Lista actualizada correctamente.");
        invalidatePriceQueries();
        router.refresh();
      } finally {
        setIsListActionBusy(false);
      }
    },
    [editingList, invalidatePriceQueries, notifySuccess, router],
  );

  const handleConfirmCreateList = useCallback(async () => {
    const nextName = createListNameDraft.trim();
    if (!nextName) {
      setListActionError("El nombre no puede estar vacío.");
      return;
    }

    setIsListActionBusy(true);
    setListActionError(null);

    try {
      const result = await createPriceListAction({ name: nextName });
      if (!result.success) {
        setListActionError(result.error);
        return;
      }

      setPriceLists((current) => [...current, result.data]);
      setSelectedListId(result.data.id);
      setIsCreateListOpen(false);
      setCreateListNameDraft("");
      notifySuccess("Lista de precios creada correctamente.");
      invalidatePriceQueries();
      router.refresh();
    } finally {
      setIsListActionBusy(false);
    }
  }, [createListNameDraft, invalidatePriceQueries, notifySuccess, router]);

  const handleConfirmDeleteList = useCallback(async () => {
    if (!deleteListTarget) {
      return;
    }

    setIsListActionBusy(true);
    setListActionError(null);

    try {
      const result = await deletePriceListAction({ id: deleteListTarget.id });
      if (!result.success) {
        setListActionError(result.error);
        return;
      }

      const nextLists = priceLists.filter((list) => list.id !== deleteListTarget.id);
      setPriceLists(nextLists);

      if (selectedListId === deleteListTarget.id) {
        setSelectedListId(getInitialListId(nextLists));
        setPage(1);
      }

      setDeleteListTarget(null);
      notifySuccess("Lista eliminada correctamente.");
      router.refresh();
    } finally {
      setIsListActionBusy(false);
    }
  }, [deleteListTarget, priceLists, router, selectedListId]);

  const openEditList = useCallback(
    (listId?: string) => {
      const targetId = listId ?? activeListId;
      const list = sortedLists.find((item) => item.id === targetId);
      if (!list) {
        return;
      }
      setListActionError(null);
      setEditingList(list);
      setListFormMode("edit");
    },
    [activeListId, sortedLists],
  );

  const openDeleteList = useCallback(
    (listId?: string) => {
      const targetId = listId ?? activeListId;
      const list = sortedLists.find((item) => item.id === targetId);
      if (!list) {
        return;
      }
      setListActionError(null);
      setDeleteListTarget(list);
    },
    [activeListId, sortedLists],
  );

  const createListNameEmpty = createListNameDraft.trim().length === 0;

  return (
    <>
      <div className={styles.page}>
        <div className={styles.body}>
          <PricePageChrome
            onImportExcelClick={isAdmin ? handleImportExcelClick : undefined}
            supplierBanner={
              activeList ? (
                <PriceSupplierBanner
                  supplierName={activeList.supplierName}
                  supplierDate={activeList.supplierDate}
                  isAdmin={isAdmin}
                  onEdit={
                    isAdmin
                      ? () => {
                          setListActionError(null);
                          setIsSupplierEditOpen(true);
                        }
                      : undefined
                  }
                />
              ) : (
                <PriceSupplierBanner
                  supplierName={null}
                  supplierDate={null}
                  isAdmin={isAdmin}
                  placeholder
                />
              )
            }
          >
            <PriceListSelectorPanel
              priceLists={sortedLists}
              selectedListId={activeListId}
              onSelectList={handleSelectList}
              onAddList={
                isAdmin
                  ? () => {
                      setListActionError(null);
                      setCreateListNameDraft("");
                      setIsCreateListOpen(true);
                    }
                  : undefined
              }
              onEditList={isAdmin ? openEditList : undefined}
              onDeleteList={isAdmin ? openDeleteList : undefined}
            />
          </PricePageChrome>

          {loadError ? <p className={styles.inlineError}>{loadError}</p> : null}
          {listActionError ? <p className={styles.inlineError}>{listActionError}</p> : null}

          <PriceItemTable
            data={activeListId ? itemTable : null}
            isLoading={isLoadingItems}
            error={itemsError ?? itemsActionError}
            isAdmin={isAdmin}
            priceListId={activeListId}
            searchQuery={listSearchQuery}
            listName={activeList?.name ?? ""}
            listSearchResetKey={activeListId}
            onSearchSubmit={handleSearchSubmit}
            enableColumnFilters
            columnFilters={columnFilters}
            onColumnFilterChange={handleColumnFilterChange}
            onClearColumnFilters={handleClearColumnFilters}
            onColumnsChanged={invalidatePriceQueries}
            hasSelectedList={Boolean(activeListId)}
            hasAnyLists={sortedLists.length > 0}
            onPageChange={handlePageChange}
            onImportExcel={isAdmin ? handleImportExcelClick : undefined}
            onEditItem={
              isAdmin
                ? (item) => {
                    setEditingItem(item);
                    setIsItemFormOpen(true);
                  }
                : undefined
            }
            onDeleteItem={isAdmin ? setDeleteItemTarget : undefined}
            columnDetails={columnDetails}
          />
        </div>
      </div>

      {isSupplierEditOpen && activeList ? (
        <LazyPriceSupplierEditModal
          initialSupplierName={activeList.supplierName}
          initialSupplierDate={activeList.supplierDate}
          isBusy={isListActionBusy}
          error={listActionError}
          onClose={() => {
            if (!isListActionBusy) {
              setIsSupplierEditOpen(false);
              setListActionError(null);
            }
          }}
          onSubmit={(values) => void handleSubmitSupplierEdit(values)}
        />
      ) : null}

      {listFormMode === "edit" ? (
        <LazyPriceListFormModal
          mode="edit"
          initialList={editingList}
          isBusy={isListActionBusy}
          error={listActionError}
          onClose={() => {
            if (!isListActionBusy) {
              setListFormMode(null);
              setEditingList(null);
              setListActionError(null);
            }
          }}
          onSubmit={(values) => void handleSubmitListForm(values)}
        />
      ) : null}

      {isCreateListOpen ? (
        <ConfirmDialog
          title="Nueva lista de precios"
          message="Ingrese el nombre de la lista de precios que desea crear."
          confirmLabel="Crear lista"
          isBusy={isListActionBusy}
          confirmDisabled={createListNameEmpty}
          onConfirm={() => void handleConfirmCreateList()}
          onCancel={() => {
            if (!isListActionBusy) {
              setIsCreateListOpen(false);
              setCreateListNameDraft("");
              setListActionError(null);
            }
          }}
        >
          <input
            className={catalogStyles.confirmInput}
            value={createListNameDraft}
            onChange={(event) => setCreateListNameDraft(event.target.value)}
            maxLength={200}
            autoFocus
            disabled={isListActionBusy}
            aria-label="Nombre de la lista de precios"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !createListNameEmpty &&
                !isListActionBusy
              ) {
                event.preventDefault();
                void handleConfirmCreateList();
              }
            }}
          />
        </ConfirmDialog>
      ) : null}

      {isItemFormOpen && activeListId ? (
        <LazyPriceItemFormModal
          key={editingItem?.id ?? "create"}
          priceListId={activeListId}
          columns={columnDetails}
          item={editingItem}
          onClose={() => {
            setIsItemFormOpen(false);
            setEditingItem(null);
          }}
          onSaved={() => {
            invalidatePriceQueries();
            notifySuccess(
              editingItem ? "Ítem actualizado correctamente." : "Ítem creado correctamente.",
            );
            void refreshListsFromServer();
          }}
        />
      ) : null}

      {isImportOpen ? (
        <LazyImportWizard
          mode="PRICE_LIST"
          catalogs={[]}
          priceLists={sortedLists}
          initialPriceListId=""
          onClose={() => setIsImportOpen(false)}
          onPublished={handleImportPublished}
        />
      ) : null}

      {deleteItemTarget ? (
        <ConfirmDialog
          title="Eliminar ítem"
          message={
            <>
              ¿Eliminar el ítem{" "}
              <strong className={catalogStyles.confirmHighlight}>
                {deleteItemTarget.primaryCode ?? deleteItemTarget.id}
              </strong>
              ? Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Eliminar"
          variant="danger"
          isBusy={isItemActionBusy}
          onConfirm={() => void handleConfirmDeleteItem()}
          onCancel={() => {
            if (!isItemActionBusy) {
              setDeleteItemTarget(null);
            }
          }}
        />
      ) : null}

      {deleteListTarget ? (
        <ConfirmDialog
          title="Eliminar lista de precios"
          message={
            <>
              ¿Eliminar la lista{" "}
              <strong className={catalogStyles.confirmHighlight}>
                {deleteListTarget.name}
              </strong>
              ? También se eliminarán todos sus ítems. Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Eliminar"
          variant="danger"
          isBusy={isListActionBusy}
          onConfirm={() => void handleConfirmDeleteList()}
          onCancel={() => {
            if (!isListActionBusy) {
              setDeleteListTarget(null);
            }
          }}
        />
      ) : null}

      {successMessage ? (
        <FloatingToast
          key={successToastKey}
          message={successMessage}
          onDismiss={dismissSuccessToast}
        />
      ) : null}
    </>
  );
}
