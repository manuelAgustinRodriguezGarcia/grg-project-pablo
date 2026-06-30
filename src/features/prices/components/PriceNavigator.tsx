"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import catalogStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import {
  clearPriceListAction,
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
import { PriceToolbar } from "@/features/prices/components/PriceToolbar";
import { ImportWizard } from "@/features/imports/components/ImportWizard";
import type { PriceColumnListItem } from "@/features/prices/types/price-column.types";
import type { PriceItemTableResponse } from "@/features/prices/types/price-item-table.types";
import type { PriceItemTableRow } from "@/features/prices/types/price-item-table.types";
import type { PriceListListItem } from "@/features/prices/types/price-list.types";
import { sortByName } from "@/features/catalog/utils/sortByName";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

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

  const [itemTable, setItemTable] = useState<PriceItemTableResponse | null>(null);
  const [columnDetails, setColumnDetails] = useState<PriceColumnListItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [listFormMode, setListFormMode] = useState<"create" | "edit" | null>(null);
  const [editingList, setEditingList] = useState<PriceListListItem | null>(null);
  const [deleteListTarget, setDeleteListTarget] = useState<PriceListListItem | null>(
    null,
  );
  const [clearListTarget, setClearListTarget] = useState<PriceListListItem | null>(null);
  const [isListActionBusy, setIsListActionBusy] = useState(false);
  const [listActionError, setListActionError] = useState<string | null>(null);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceItemTableRow | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<PriceItemTableRow | null>(null);
  const [isItemActionBusy, setIsItemActionBusy] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setSuccessMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  useEffect(() => {
    if (!activeListId) {
      return;
    }

    let cancelled = false;

    async function loadItems() {
      setIsLoadingItems(true);
      setItemsError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });

        if (debouncedSearch) {
          params.set("q", debouncedSearch);
        }

        const [itemsResponse, columnsResponse] = await Promise.all([
          fetch(`/api/admin/price-lists/${activeListId}/items?${params.toString()}`),
          isAdmin
            ? fetch(`/api/admin/price-lists/${activeListId}/columns`)
            : Promise.resolve(null),
        ]);

        if (!itemsResponse.ok) {
          const payload = (await itemsResponse.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error ?? "No se pudieron cargar los ítems.");
        }

        const itemsData = (await itemsResponse.json()) as PriceItemTableResponse;

        let nextColumnDetails: PriceColumnListItem[] = itemsData.columns.map(
          (column) => ({
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
          }),
        );

        if (isAdmin && columnsResponse) {
          if (!columnsResponse.ok) {
            const payload = (await columnsResponse.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(payload?.error ?? "No se pudieron cargar las columnas.");
          }

          const columnsData = (await columnsResponse.json()) as {
            columns: PriceColumnListItem[];
          };
          nextColumnDetails = columnsData.columns;
        }

        if (cancelled) {
          return;
        }

        setItemTable(itemsData);
        setColumnDetails(nextColumnDetails);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setItemTable(null);
        setColumnDetails([]);
        setItemsError(
          error instanceof Error ? error.message : "No se pudieron cargar los ítems.",
        );
      } finally {
        if (!cancelled) {
          setIsLoadingItems(false);
        }
      }
    }

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [activeListId, page, debouncedSearch, reloadToken, isAdmin]);

  const handleSelectList = useCallback((listId: string) => {
    setSelectedListId(listId);
    setPage(1);
    setItemTable(null);
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
        setItemsError(payload?.error ?? "No se pudo eliminar el ítem.");
        return;
      }

      setDeleteItemTarget(null);
      setReloadToken((token) => token + 1);
      setSuccessMessage("Ítem eliminado correctamente.");
      void refreshListsFromServer();
    } finally {
      setIsItemActionBusy(false);
    }
  }, [activeListId, deleteItemTarget, refreshListsFromServer]);

  const handleImportExcelClick = useCallback(() => {
    setIsImportOpen(true);
  }, []);

  const handleAddItemClick = useCallback(() => {
    setListActionError(null);

    if (!activeListId) {
      setListActionError("Seleccioná una lista de precios para agregar ítems.");
      return;
    }

    setEditingItem(null);
    setIsItemFormOpen(true);
  }, [activeListId]);

  const handleImportPublished = useCallback(
    async (context?: { priceListId?: string }) => {
      setReloadToken((token) => token + 1);
      setSuccessMessage("Importación de precios completada.");

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
      setIsListActionBusy(true);
      setListActionError(null);

      try {
        if (listFormMode === "create") {
          const result = await createPriceListAction({
            name: values.name,
            description: values.description || null,
            status: values.status,
            visibleToNormalUser: values.visibleToNormalUser,
          });

          if (!result.success) {
            setListActionError(result.error);
            return;
          }

          setPriceLists((current) => [...current, result.data]);
          setSelectedListId(result.data.id);
          setListFormMode(null);
          setSuccessMessage("Lista de precios creada correctamente.");
        } else if (editingList) {
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
          setSuccessMessage("Lista actualizada correctamente.");
        }

        setReloadToken((token) => token + 1);
        router.refresh();
      } finally {
        setIsListActionBusy(false);
      }
    },
    [editingList, listFormMode, router],
  );

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
        setItemTable(null);
      }

      setDeleteListTarget(null);
      setSuccessMessage("Lista eliminada correctamente.");
      router.refresh();
    } finally {
      setIsListActionBusy(false);
    }
  }, [deleteListTarget, priceLists, router, selectedListId]);

  const handleConfirmClearList = useCallback(async () => {
    if (!clearListTarget) {
      return;
    }

    setIsListActionBusy(true);
    setListActionError(null);

    try {
      const result = await clearPriceListAction({ id: clearListTarget.id });
      if (!result.success) {
        setListActionError(result.error);
        return;
      }

      setPriceLists((current) =>
        current.map((list) =>
          list.id === clearListTarget.id
            ? { ...list, itemCount: 0, updatedAt: new Date().toISOString() }
            : list,
        ),
      );
      setClearListTarget(null);
      setReloadToken((token) => token + 1);
      setSuccessMessage(
        `Se eliminaron ${result.data.deletedCount.toLocaleString("es-AR")} ítems.`,
      );
      void refreshListsFromServer();
      router.refresh();
    } finally {
      setIsListActionBusy(false);
    }
  }, [clearListTarget, refreshListsFromServer, router]);

  const activeList =
    sortedLists.find((list) => list.id === activeListId) ?? null;

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

  return (
    <>
      <div className={styles.page}>
        <div className={styles.body}>
          <PricePageChrome
            searchQuery={searchInput}
            onSearchChange={setSearchInput}
            onSearchClear={() => setSearchInput("")}
            searchDisabled={!activeListId}
            onImportExcelClick={isAdmin ? handleImportExcelClick : undefined}
            onAddItemClick={isAdmin ? handleAddItemClick : undefined}
          >
            <PriceListSelectorPanel
              priceLists={sortedLists}
              selectedListId={activeListId}
              onSelectList={handleSelectList}
              onAddList={
                isAdmin
                  ? () => {
                      setListActionError(null);
                      setEditingList(null);
                      setListFormMode("create");
                    }
                  : undefined
              }
              onEditList={isAdmin ? openEditList : undefined}
              onDeleteList={isAdmin ? openDeleteList : undefined}
            />
          </PricePageChrome>

          {isAdmin ? (
            <PriceToolbar
              hasSelectedList={Boolean(activeListId)}
              onClearList={() => {
                if (activeList) {
                  setClearListTarget(activeList);
                }
              }}
            />
          ) : null}

          {loadError ? <p className={styles.inlineError}>{loadError}</p> : null}
          {listActionError ? <p className={styles.inlineError}>{listActionError}</p> : null}
          {successMessage ? (
            <p className={styles.successBanner} role="status">
              {successMessage}
            </p>
          ) : null}

          <PriceItemTable
            data={activeListId ? itemTable : null}
            isLoading={isLoadingItems}
            error={itemsError}
            isAdmin={isAdmin}
            searchQuery={debouncedSearch}
            hasSelectedList={Boolean(activeListId)}
            hasAnyLists={sortedLists.length > 0}
            onPageChange={handlePageChange}
            onAddItem={() => {
              setEditingItem(null);
              setIsItemFormOpen(true);
            }}
            onCreateList={() => {
              setListFormMode("create");
            }}
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

      {listFormMode ? (
        <PriceListFormModal
          mode={listFormMode}
          initialList={listFormMode === "edit" ? editingList : null}
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
            setSuccessMessage(
              editingItem ? "Ítem actualizado correctamente." : "Ítem creado correctamente.",
            );
            void refreshListsFromServer();
          }}
        />
      ) : null}

      {isImportOpen ? (
        <ImportWizard
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

      {clearListTarget ? (
        <ConfirmDialog
          title="Vaciar lista de precios"
          message={
            <>
              ¿Vaciar todos los ítems de{" "}
              <strong className={catalogStyles.confirmHighlight}>
                {clearListTarget.name}
              </strong>
              ? La lista seguirá existiendo, pero quedará sin registros.
            </>
          }
          confirmLabel="Vaciar lista"
          variant="danger"
          isBusy={isListActionBusy}
          onConfirm={() => void handleConfirmClearList()}
          onCancel={() => {
            if (!isListActionBusy) {
              setClearListTarget(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
