"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import catalogStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import {
  createPriceListAction,
  deletePriceListAction,
  updatePriceListAction,
} from "@/features/prices/actions/price-list.actions";
import { PriceItemFormModal } from "@/features/prices/components/PriceItemFormModal";
import { PriceItemTable } from "@/features/prices/components/PriceItemTable";
import { PriceListFormModal } from "@/features/prices/components/PriceListFormModal";
import type { PriceListFormValues } from "@/features/prices/components/PriceListFormModal";
import { PriceListSelectorPanel } from "@/features/prices/components/PriceListSelectorPanel";
import { PricePageChrome } from "@/features/prices/components/PricePageChrome";
import { LazyImportWizard } from "@/features/imports/components/LazyImportWizard";
import type { PriceColumnListItem } from "@/features/prices/types/price-column.types";
import type { PriceItemTableResponse } from "@/features/prices/types/price-item-table.types";
import type { PriceItemTableRow } from "@/features/prices/types/price-item-table.types";
import type { PriceListListItem } from "@/features/prices/types/price-list.types";
import { sortByName } from "@/features/catalog/utils/sortByName";
import { FloatingToast } from "@/shared/components/FloatingToast";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

const PAGE_SIZE = 25;

type PriceNavigatorProps = {
  initialPriceLists: PriceListListItem[];
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
  isAdmin,
  loadError,
}: PriceNavigatorProps) {
  const router = useRouter();
  const [priceLists, setPriceLists] = useState(initialPriceLists);
  const [prevInitialLists, setPrevInitialLists] = useState(initialPriceLists);

  if (initialPriceLists !== prevInitialLists) {
    setPrevInitialLists(initialPriceLists);
    setPriceLists(initialPriceLists);
  }

  const sortedLists = useMemo(() => sortByName(priceLists), [priceLists]);
  const [selectedListId, setSelectedListId] = useState(() =>
    getInitialListId(initialPriceLists),
  );

  const activeListId = useMemo(
    () => resolveListId(sortedLists, selectedListId),
    [sortedLists, selectedListId],
  );

  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
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

  const notifySuccess = useCallback((message: string) => {
    setSuccessToastKey((current) => current + 1);
    setSuccessMessage(message);
  }, []);

  const dismissSuccessToast = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  const handleDebouncedSearchChange = useCallback((query: string) => {
    setDebouncedSearch(query);
    setPage(1);
  }, []);

  const columnsQuery = useQuery({
    queryKey: ["admin", "price-columns", activeListId, reloadToken],
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
    queryKey: ["admin", "price-items", activeListId, page, debouncedSearch, reloadToken],
    queryFn: async (): Promise<PriceItemTableResponse> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (debouncedSearch) {
        params.set("q", debouncedSearch);
      }

      const itemsResponse = await fetch(
        `/api/admin/price-lists/${activeListId}/items?${params.toString()}`,
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
      setReloadToken((token) => token + 1);
      notifySuccess("Ítem eliminado correctamente.");
      void refreshListsFromServer();
    } finally {
      setIsItemActionBusy(false);
    }
  }, [activeListId, deleteItemTarget, refreshListsFromServer]);

  const handleImportExcelClick = useCallback(() => {
    setIsImportOpen(true);
  }, []);

  const handleImportPublished = useCallback(
    async (context?: { priceListId?: string }) => {
      setReloadToken((token) => token + 1);
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
    [activeListId, router],
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
          description: values.description || null,
          status: values.status,
          visibleToNormalUser: values.visibleToNormalUser,
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
        setReloadToken((token) => token + 1);
        router.refresh();
      } finally {
        setIsListActionBusy(false);
      }
    },
    [editingList, router],
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
      setReloadToken((token) => token + 1);
      router.refresh();
    } finally {
      setIsListActionBusy(false);
    }
  }, [createListNameDraft, router]);

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
            onDebouncedSearchChange={handleDebouncedSearchChange}
            searchDisabled={!activeListId}
            onImportExcelClick={isAdmin ? handleImportExcelClick : undefined}
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
            searchQuery={debouncedSearch}
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

      {listFormMode === "edit" ? (
        <PriceListFormModal
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
        <PriceItemFormModal
          key={editingItem?.id ?? "create"}
          priceListId={activeListId}
          columns={columnDetails}
          item={editingItem}
          onClose={() => {
            setIsItemFormOpen(false);
            setEditingItem(null);
          }}
          onSaved={() => {
            setReloadToken((token) => token + 1);
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
          initialPriceListId={activeListId}
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
