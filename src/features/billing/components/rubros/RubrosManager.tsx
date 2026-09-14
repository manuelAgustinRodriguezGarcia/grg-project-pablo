"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  useAdminSectionTransition,
  useReportAdminSectionReady,
} from "@/features/admin/components/AdminSectionTransition";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import {
  createBillingRubroAction,
  deleteBillingRubroAction,
  listBillingRubrosAction,
  updateBillingRubroAction,
} from "@/features/billing/actions/billing-rubro.actions";
import type { RubroFormValues } from "@/features/billing/components/rubros/RubroFormModal";
import { RubroFormModal } from "@/features/billing/components/rubros/RubroFormModal";
import type { RubroSortOrder } from "@/features/billing/components/rubros/RubrosPageIntro";
import { RubrosInsightsPanel } from "@/features/billing/components/rubros/RubrosInsightsPanel";
import { RubrosPageIntro } from "@/features/billing/components/rubros/RubrosPageIntro";
import { RubrosTable } from "@/features/billing/components/rubros/RubrosTable";
import { useBillingInvoicesQuery } from "@/features/billing/hooks/useBillingInvoicesQuery";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import type { BillingRubroListItem } from "@/features/billing/types/billing-rubro.types";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type RubrosManagerProps = {
  initialRubros: BillingRubroListItem[];
  initialInvoices?: BillingInvoiceListItem[];
};

function toActionPayload(values: RubroFormValues) {
  return {
    code: values.code || null,
    name: values.name,
    description: values.description || null,
  };
}

export function RubrosManager({
  initialRubros,
  initialInvoices = [],
}: RubrosManagerProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<RubroSortOrder>("name-az");

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingRubro, setEditingRubro] =
    useState<BillingRubroListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isFormBusy, setIsFormBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState<BillingRubroListItem | null>(null);
  const [busyRubroId, setBusyRubroId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rubrosQuery = useQuery({
    queryKey: adminQueryKeys.billingRubros(),
    queryFn: async (): Promise<BillingRubroListItem[]> => {
      const result = await listBillingRubrosAction();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    initialData: initialRubros,
    staleTime: 30_000,
  });
  const invoicesQuery = useBillingInvoicesQuery(initialInvoices);

  const filteredRubros = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");

    const filtered = (rubrosQuery.data ?? []).filter((rubro) => {
      if (statusFilter !== "all" && rubro.status !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        rubro.name.toLocaleLowerCase("es-AR").includes(normalizedQuery) ||
        rubro.code.toLocaleLowerCase("es-AR").includes(normalizedQuery)
      );
    });

    return filtered.sort((left, right) => {
      if (sortOrder === "code-az" || sortOrder === "code-za") {
        const comparison = left.code.localeCompare(right.code, "es-AR");
        return sortOrder === "code-az" ? comparison : -comparison;
      }

      const comparison = left.name.localeCompare(right.name, "es-AR");
      return sortOrder === "name-az" ? comparison : -comparison;
    });
  }, [rubrosQuery.data, query, statusFilter, sortOrder]);

  const invalidateRubros = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.billingRubros(),
    });
  }, [queryClient]);

  const handleOpenCreate = useCallback(() => {
    setActionError(null);
    setFormError(null);
    setEditingRubro(null);
    setFormMode("create");
  }, []);

  const handleOpenEdit = useCallback((rubro: BillingRubroListItem) => {
    setActionError(null);
    setFormError(null);
    setEditingRubro(rubro);
    setFormMode("edit");
  }, []);

  const handleCloseForm = useCallback(() => {
    if (isFormBusy) {
      return;
    }
    setFormMode(null);
    setEditingRubro(null);
    setFormError(null);
  }, [isFormBusy]);

  const handleSubmitForm = useCallback(
    async (values: RubroFormValues) => {
      setIsFormBusy(true);
      setFormError(null);

      try {
        if (formMode === "create") {
          const result = await createBillingRubroAction(
            toActionPayload(values),
          );

          if (!result.success) {
            setFormError(result.error);
            return;
          }
        } else if (formMode === "edit" && editingRubro) {
          const result = await updateBillingRubroAction({
            id: editingRubro.id,
            ...toActionPayload(values),
          });

          if (!result.success) {
            setFormError(result.error);
            return;
          }
        }

        await invalidateRubros();
        setFormMode(null);
        setEditingRubro(null);
      } finally {
        setIsFormBusy(false);
      }
    },
    [editingRubro, formMode, invalidateRubros],
  );

  const handleToggleStatus = useCallback(
    async (rubro: BillingRubroListItem) => {
      setBusyRubroId(rubro.id);
      setActionError(null);

      try {
        const result = await updateBillingRubroAction({
          id: rubro.id,
          name: rubro.name,
          description: rubro.description,
          status: rubro.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        });

        if (!result.success) {
          setActionError(result.error);
          return;
        }

        await invalidateRubros();
      } finally {
        setBusyRubroId(null);
      }
    },
    [invalidateRubros],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    setBusyRubroId(deleteTarget.id);
    setActionError(null);

    try {
      const result = await deleteBillingRubroAction({
        rubroId: deleteTarget.id,
      });

      if (!result.success) {
        setActionError(result.error);
        return;
      }

      await invalidateRubros();
      setDeleteTarget(null);
    } finally {
      setBusyRubroId(null);
    }
  }, [deleteTarget, invalidateRubros]);

  const listError =
    rubrosQuery.error instanceof Error ? rubrosQuery.error.message : null;
  const isLoading = rubrosQuery.isFetching && !rubrosQuery.data;

  const sectionTransition = useAdminSectionTransition();
  const hideInternalLoaders = sectionTransition?.isCoveringContent ?? false;
  const isSectionContentReady = !isLoading || Boolean(listError);
  useReportAdminSectionReady(isSectionContentReady);

  return (
    <>
      <div className={styles.page}>
        <div className={styles.body}>
          <RubrosPageIntro
            query={query}
            statusFilter={statusFilter}
            sortOrder={sortOrder}
            onQueryChange={setQuery}
            onStatusFilterChange={setStatusFilter}
            onSortOrderChange={setSortOrder}
            onCreateClick={handleOpenCreate}
          />

          {actionError ? (
            <p className={styles.inlineError}>{actionError}</p>
          ) : null}

          <div className={styles.contentLayout}>
            <div className={styles.tableColumn}>
              <RubrosTable
                rubros={filteredRubros}
                isLoading={hideInternalLoaders ? false : isLoading}
                error={listError}
                busyRubroId={busyRubroId}
                onEdit={handleOpenEdit}
                onToggleStatus={(rubro) => void handleToggleStatus(rubro)}
                onDelete={setDeleteTarget}
                onCreateClick={handleOpenCreate}
              />
            </div>
            <RubrosInsightsPanel invoices={invoicesQuery.data ?? []} />
          </div>
        </div>
      </div>

      {formMode ? (
        <RubroFormModal
          mode={formMode}
          initialRubro={editingRubro}
          isBusy={isFormBusy}
          error={formError}
          onClearError={() => setFormError(null)}
          onClose={handleCloseForm}
          onSubmit={(values) => void handleSubmitForm(values)}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Eliminar rubro"
          message={`¿Eliminar el rubro ${deleteTarget.name} (${deleteTarget.code})? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          isBusy={busyRubroId === deleteTarget.id}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => {
            if (busyRubroId !== deleteTarget.id) {
              setDeleteTarget(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
