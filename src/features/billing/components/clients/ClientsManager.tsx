"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAdminSectionTransition,
  useReportAdminSectionReady,
} from "@/features/admin/components/AdminSectionTransition";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import {
  createBillingClientAction,
  deleteBillingClientAction,
  updateBillingClientAction,
} from "@/features/billing/actions/billing-client.actions";
import { ClientDetailsModal } from "@/features/billing/components/clients/ClientDetailsModal";
import type { ClientFormValues } from "@/features/billing/components/clients/ClientFormModal";
import { ClientFormModal } from "@/features/billing/components/clients/ClientFormModal";
import type { ClientSortOrder } from "@/features/billing/components/clients/ClientsPageIntro";
import { ClientsInsightsPanel } from "@/features/billing/components/clients/ClientsInsightsPanel";
import { ClientsPageIntro } from "@/features/billing/components/clients/ClientsPageIntro";
import { ClientsTable } from "@/features/billing/components/clients/ClientsTable";
import {
  NoteFormModal,
  type NoteFormMode,
} from "@/features/billing/components/invoices/NoteFormModal";
import {
  ReceiptFormModal,
  type ReceiptFormMode,
} from "@/features/billing/components/recibos/ReceiptFormModal";
import {
  BILLING_CLIENT_HISTORY_QUERY,
  BILLING_CLIENT_ID_QUERY,
} from "@/features/billing/data/billingNav";
import { useBillingClientsQuery } from "@/features/billing/hooks/useBillingClientsQuery";
import { useBillingInvoicesQuery } from "@/features/billing/hooks/useBillingInvoicesQuery";
import { useBillingNotesQuery } from "@/features/billing/hooks/useBillingNotesQuery";
import { useBillingReceiptsQuery } from "@/features/billing/hooks/useBillingReceiptsQuery";
import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import { buildClientHistoryIdSet } from "@/features/billing/utils/client-form-matches";
import {
  applyLiveClientNames,
  buildClientInvoiceSummaryMap,
  clientHasDebt,
  invoiceCanIssueReceipt,
  listDebtorClients,
  listTopClientsByBilling,
} from "@/features/billing/utils/invoice-list";
import { normalizeIdentificationDigits } from "@/shared/utils/identification";
import { centsToPesos } from "@/shared/utils/billing-invoice-totals";
import { clientAvailableCreditCents } from "@/features/billing/utils/receipt-allocation";
import { replaceSearchParams } from "@/shared/lib/replace-search-params";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type ClientsManagerProps = {
  initialClients: BillingClientListItem[];
  initialInvoices?: BillingInvoiceListItem[];
  openClientId?: string;
  openClientHistory?: boolean;
};

function toActionPayload(values: ClientFormValues, includeCode: boolean) {
  return {
    name: values.name,
    ...(includeCode ? { code: values.code } : {}),
    address: values.address || null,
    city: values.city || null,
    province: values.province || null,
    email: values.email || null,
    whatsapp: values.whatsapp || null,
    identificationType: values.identificationType,
    identificationNumber: values.identificationNumber || null,
    ivaCondition: values.ivaCondition,
    notes: values.notes || null,
  };
}

export function ClientsManager({
  initialClients,
  initialInvoices = [],
  openClientId,
  openClientHistory = false,
}: ClientsManagerProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [identificationFilter, setIdentificationFilter] = useState("all");
  const [ivaFilter, setIvaFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<ClientSortOrder>("az");

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingClient, setEditingClient] =
    useState<BillingClientListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isFormBusy, setIsFormBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState<BillingClientListItem | null>(null);
  const [detailsClient, setDetailsClient] =
    useState<BillingClientListItem | null>(null);
  const [focusClientHistory, setFocusClientHistory] = useState(false);
  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [receiptForm, setReceiptForm] = useState<ReceiptFormMode | null>(null);
  const [noteForm, setNoteForm] = useState<NoteFormMode | null>(null);
  const consumedOpenClientId = useRef<string | null>(null);

  const clientsQuery = useBillingClientsQuery(initialClients);

  const invoicesQuery = useBillingInvoicesQuery(initialInvoices);
  const receiptsQuery = useBillingReceiptsQuery();
  const notesQuery = useBillingNotesQuery();

  const clientsWithHistory = useMemo(
    () =>
      buildClientHistoryIdSet(
        invoicesQuery.data ?? [],
        receiptsQuery.data ?? [],
        notesQuery.data ?? [],
      ),
    [invoicesQuery.data, notesQuery.data, receiptsQuery.data],
  );

  useEffect(() => {
    if (!openClientId) {
      consumedOpenClientId.current = null;
      return;
    }

    if (consumedOpenClientId.current === openClientId) {
      return;
    }

    const client = (clientsQuery.data ?? []).find(
      (item) => item.id === openClientId,
    );
    if (!client) {
      return;
    }

    consumedOpenClientId.current = openClientId;
    setDetailsClient(client);
    setFocusClientHistory(openClientHistory);
    replaceSearchParams({
      [BILLING_CLIENT_ID_QUERY]: null,
      [BILLING_CLIENT_HISTORY_QUERY]: null,
    });
  }, [clientsQuery.data, openClientHistory, openClientId]);

  const liveDetailsClient = useMemo(() => {
    if (!detailsClient) {
      return null;
    }

    return (
      (clientsQuery.data ?? []).find((item) => item.id === detailsClient.id) ??
      detailsClient
    );
  }, [clientsQuery.data, detailsClient]);

  const invoiceSummaries = useMemo(
    () =>
      applyLiveClientNames(
        buildClientInvoiceSummaryMap(invoicesQuery.data ?? []),
        clientsQuery.data ?? [],
      ),
    [clientsQuery.data, invoicesQuery.data],
  );
  const topClients = useMemo(
    () => listTopClientsByBilling(invoiceSummaries.values()),
    [invoiceSummaries],
  );
  const debtorClients = useMemo(
    () => listDebtorClients(invoiceSummaries.values()),
    [invoiceSummaries],
  );

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
    const queryDigits = normalizeIdentificationDigits(normalizedQuery);

    const filtered = (clientsQuery.data ?? []).filter((client) => {
      if (
        identificationFilter !== "all" &&
        client.identificationType !== identificationFilter
      ) {
        return false;
      }

      if (ivaFilter !== "all" && client.ivaCondition !== ivaFilter) {
        return false;
      }

      if (paymentFilter === "adeuda" && !clientHasDebt(invoiceSummaries, client.id)) {
        return false;
      }

      if (paymentFilter === "al-dia" && clientHasDebt(invoiceSummaries, client.id)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const matchesText =
        client.name.toLocaleLowerCase("es-AR").includes(normalizedQuery) ||
        client.code.toLocaleLowerCase("es-AR").includes(normalizedQuery);

      const matchesIdentification =
        queryDigits.length > 0 &&
        client.identificationNumber !== null &&
        client.identificationNumber.includes(queryDigits);

      return matchesText || matchesIdentification;
    });

    return filtered.sort((left, right) => {
      const comparison = left.name.localeCompare(right.name, "es-AR");
      return sortOrder === "az" ? comparison : -comparison;
    });
  }, [
    clientsQuery.data,
    query,
    identificationFilter,
    ivaFilter,
    paymentFilter,
    sortOrder,
    invoiceSummaries,
  ]);

  const invalidateClients = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.billingClients(),
    });
  }, [queryClient]);

  const handleOpenDetails = useCallback((client: BillingClientListItem) => {
    setFocusClientHistory(false);
    setDetailsClient(client);
  }, []);

  const handleOpenCreate = useCallback(() => {
    setActionError(null);
    setFormError(null);
    setEditingClient(null);
    setFormMode("create");
  }, []);

  const handleOpenEdit = useCallback((client: BillingClientListItem) => {
    setActionError(null);
    setFormError(null);
    setEditingClient(client);
    setFormMode("edit");
  }, []);

  const handleCloseForm = useCallback(() => {
    if (isFormBusy) {
      return;
    }
    setFormMode(null);
    setEditingClient(null);
    setFormError(null);
  }, [isFormBusy]);

  const handleSubmitForm = useCallback(
    async (values: ClientFormValues) => {
      setIsFormBusy(true);
      setFormError(null);

      try {
        if (formMode === "create") {
          const result = await createBillingClientAction(
            toActionPayload(values, false),
          );

          if (!result.success) {
            setFormError(result.error);
            return;
          }
        } else if (formMode === "edit" && editingClient) {
          const result = await updateBillingClientAction({
            id: editingClient.id,
            ...toActionPayload(values, true),
          });

          if (!result.success) {
            setFormError(result.error);
            return;
          }
        }

        await invalidateClients();
        setFormMode(null);
        setEditingClient(null);
      } finally {
        setIsFormBusy(false);
      }
    },
    [editingClient, formMode, invalidateClients],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    setBusyClientId(deleteTarget.id);
    setActionError(null);

    try {
      const result = await deleteBillingClientAction({
        clientId: deleteTarget.id,
      });

      if (!result.success) {
        setActionError(result.error);
        return;
      }

      await invalidateClients();
      setDeleteTarget(null);
    } finally {
      setBusyClientId(null);
    }
  }, [deleteTarget, invalidateClients]);

  const listError =
    clientsQuery.error instanceof Error ? clientsQuery.error.message : null;
  const isLoading = clientsQuery.isFetching && !clientsQuery.data;

  const sectionTransition = useAdminSectionTransition();
  const hideInternalLoaders = sectionTransition?.isCoveringContent ?? false;
  const isSectionContentReady = !isLoading || Boolean(listError);
  useReportAdminSectionReady(isSectionContentReady);

  return (
    <>
      <div className={styles.page}>
        <div className={styles.body}>
          <ClientsPageIntro
            query={query}
            identificationFilter={identificationFilter}
            ivaFilter={ivaFilter}
            paymentFilter={paymentFilter}
            sortOrder={sortOrder}
            onQueryChange={setQuery}
            onIdentificationFilterChange={setIdentificationFilter}
            onIvaFilterChange={setIvaFilter}
            onPaymentFilterChange={setPaymentFilter}
            onSortOrderChange={setSortOrder}
            onCreateClick={handleOpenCreate}
          />

          {actionError ? (
            <p className={styles.inlineError}>{actionError}</p>
          ) : null}

          <div className={styles.contentLayout}>
            <div className={styles.tableColumn}>
              <ClientsTable
                clients={filteredClients}
                invoiceSummaries={invoiceSummaries}
                clientsWithHistory={clientsWithHistory}
                isLoading={hideInternalLoaders ? false : isLoading}
                error={listError}
                busyClientId={busyClientId}
                onDetails={handleOpenDetails}
                onEdit={handleOpenEdit}
                onDelete={setDeleteTarget}
                onCreateClick={handleOpenCreate}
              />
            </div>
            <ClientsInsightsPanel
              topClients={topClients}
              debtorClients={debtorClients}
            />
          </div>
        </div>
      </div>

      {liveDetailsClient ? (
        <ClientDetailsModal
          client={liveDetailsClient}
          invoices={invoicesQuery.data ?? []}
          creditAmount={centsToPesos(
            clientAvailableCreditCents(
              receiptsQuery.data ?? [],
              invoicesQuery.data ?? [],
              liveDetailsClient.id,
            ),
          )}
          focusHistory={focusClientHistory}
          onClose={() => {
            setDetailsClient(null);
            setFocusClientHistory(false);
          }}
          onIssueReceipt={(invoice) => {
            if (!invoice.clientId || !invoiceCanIssueReceipt(invoice)) {
              return;
            }
            setReceiptForm({
              kind: "create-from-invoice",
              invoiceId: invoice.id,
              clientId: invoice.clientId,
            });
          }}
          onIssueNote={(invoice, kind) => {
            setNoteForm({ kind, invoiceId: invoice.id });
          }}
        />
      ) : null}

      {receiptForm ? (
        <ReceiptFormModal
          mode={receiptForm}
          clients={clientsQuery.data ?? []}
          invoices={invoicesQuery.data ?? []}
          receipts={receiptsQuery.data ?? []}
          onClose={() => setReceiptForm(null)}
        />
      ) : null}

      {noteForm ? (
        <NoteFormModal
          mode={noteForm}
          invoices={invoicesQuery.data ?? []}
          onClose={() => setNoteForm(null)}
        />
      ) : null}

      {formMode ? (
        <ClientFormModal
          mode={formMode}
          initialClient={editingClient}
          existingClients={clientsQuery.data ?? []}
          identificationLocked={
            formMode === "edit" &&
            editingClient != null &&
            clientsWithHistory.has(editingClient.id)
          }
          isBusy={isFormBusy}
          error={formError}
          onClearError={() => setFormError(null)}
          onClose={handleCloseForm}
          onSubmit={(values) => void handleSubmitForm(values)}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Eliminar cliente"
          message={`¿Eliminar a ${deleteTarget.name} (${deleteTarget.code})? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          isBusy={busyClientId === deleteTarget.id}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => {
            if (busyClientId !== deleteTarget.id) {
              setDeleteTarget(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
