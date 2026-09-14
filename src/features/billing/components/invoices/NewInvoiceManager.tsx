"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BillingPaymentMethod } from "@/generated/prisma/client";
import { useAdminSectionTransition, useReportAdminSectionReady } from "@/features/admin/components/AdminSectionTransition";
import { adminQueryKeys } from "@/features/admin/query-keys";
import {
  createBillingClientAction,
  ensureGenericBillingClientAction,
} from "@/features/billing/actions/billing-client.actions";
import { listBillingRubrosAction } from "@/features/billing/actions/billing-rubro.actions";
import { createBillingInvoiceAction } from "@/features/billing/actions/billing-invoice.actions";
import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";
import {
  ClientFormModal,
  type ClientFormValues,
} from "@/features/billing/components/clients/ClientFormModal";
import type { BillingRubroListItem } from "@/features/billing/types/billing-rubro.types";
import type {
  BillingFiscalContext,
  BillingInvoiceListItem,
} from "@/features/billing/types/billing-invoice.types";
import { InvoiceDocumentActions } from "@/features/billing/components/invoices/InvoiceDocumentActions";
import { InvoiceCreateConfirmModal } from "@/features/billing/components/invoices/InvoiceCreateConfirmModal";
import { UnprintedInvoiceLeaveDialog } from "@/features/billing/components/invoices/UnprintedInvoiceLeaveDialog";
import { BILLING_INVOICES_PATH } from "@/features/billing/data/billingNav";
import { resolveUnprintedLeaveAction } from "@/features/billing/utils/unprinted-invoice-leave";
import type { UnprintedLeaveIntent } from "@/features/billing/utils/unprinted-invoice-leave";
import { useBillingClientsQuery } from "@/features/billing/hooks/useBillingClientsQuery";
import { useBillingDocumentActivity } from "@/features/billing/hooks/useBillingDocumentActivity";
import { fetchBillingInvoicesList } from "@/features/billing/hooks/useBillingInvoicesQuery";
import { useBillingSuccessShortcuts } from "@/features/billing/hooks/useBillingModalKeyboard";
import { useInvoiceKeyboardFlow } from "@/features/billing/hooks/useInvoiceKeyboardFlow";
import { INVOICE_TYPE_LABELS } from "@/features/billing/types/billing-invoice.types";
import { formatArs } from "@/features/billing/utils/format-ars";
import { prependBillingInvoiceInList } from "@/features/billing/utils/invoice-list";
import { printInvoicePdf } from "@/features/billing/utils/invoice-pdf-client";
import {
  determineInvoiceType,
  isCanonicalGenericBillingClient,
  isGenericBillingClient,
  canInvoiceUseOnAccountPayment,
} from "@/shared/utils/billing-invoice-rules";
import {
  computeInvoiceTotals,
  pesosToCents,
  type InvoiceTotals,
} from "@/shared/utils/billing-invoice-totals";
import { AlertTriangle, CheckCircle2, ICON_STROKE, Info, ReceiptText } from "@/shared/icons";
import { InvoiceClientSection } from "./InvoiceClientSection";
import {
  InvoiceItemsSection,
  isCompleteRow,
  isEmptyDraftRow,
  isPartialDraftRow,
  parseRowQuantity,
  parseRowUnitPrice,
  withoutTrailingEmptyDraftRows,
  type InvoiceItemRow,
} from "./InvoiceItemsSection";
import { InvoiceSummarySection } from "./InvoiceSummarySection";
import { useUnsavedInvoiceDraft } from "./UnsavedInvoiceDraftContext";
import styles from "@/features/billing/styles/NewInvoice.module.scss";

type NewInvoiceManagerProps = {
  initialClients: BillingClientListItem[];
  initialRubros: BillingRubroListItem[];
  fiscalContext: BillingFiscalContext;
};

function createRowKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `row-${crypto.randomUUID()}`;
  }

  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyRow(): InvoiceItemRow {
  return {
    key: createRowKey(),
    rubroId: null,
    rubroCode: "",
    rubroName: "",
    rubroQuery: "",
    description: "",
    quantity: "1",
    unitPrice: "",
  };
}

export function NewInvoiceManager({
  initialClients,
  initialRubros,
  fiscalContext,
}: NewInvoiceManagerProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const sectionTransition = useAdminSectionTransition();

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: adminQueryKeys.billingInvoices(),
      queryFn: fetchBillingInvoicesList,
    });
  }, [queryClient]);
  const [selectedClient, setSelectedClient] =
    useState<BillingClientListItem | null>(null);
  const [rows, setRows] = useState<InvoiceItemRow[]>(() => [createEmptyRow()]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] =
    useState<BillingPaymentMethod>("CONTADO");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdInvoice, setCreatedInvoice] =
    useState<BillingInvoiceListItem | null>(null);
  const [successShareOpen, setSuccessShareOpen] = useState(false);
  const [hasPrintedInvoice, setHasPrintedInvoice] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<UnprintedLeaveIntent | null>(
    null,
  );
  const [isLeavePrinting, setIsLeavePrinting] = useState(false);
  const [leavePrintError, setLeavePrintError] = useState<string | null>(null);
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [createClientError, setCreateClientError] = useState<string | null>(
    null,
  );
  const [genericClientError, setGenericClientError] = useState<string | null>(
    null,
  );
  const [isSelectingGenericClient, setIsSelectingGenericClient] =
    useState(false);
  const unsavedDraft = useUnsavedInvoiceDraft();

  useReportAdminSectionReady(true);

  const clientsQuery = useBillingClientsQuery(initialClients);

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

  const activeRubros = useMemo(
    () =>
      (rubrosQuery.data ?? []).filter((rubro) => rubro.status === "ACTIVE"),
    [rubrosQuery.data],
  );

  const invoiceType = selectedClient
    ? determineInvoiceType(
        selectedClient.identificationType,
        selectedClient.ivaCondition,
      )
    : null;
  const allowOnAccount = selectedClient
    ? canInvoiceUseOnAccountPayment(selectedClient.identificationType)
    : true;

  const completeRows = useMemo(() => rows.filter(isCompleteRow), [rows]);

  const totals: InvoiceTotals | null = useMemo(() => {
    if (!invoiceType || completeRows.length === 0) {
      return null;
    }

    return computeInvoiceTotals({
      invoiceType,
      items: completeRows.map((row) => ({
        quantity: parseRowQuantity(row) ?? 0,
        unitPriceCents: pesosToCents(parseRowUnitPrice(row) ?? 0),
      })),
      ivaPercent: fiscalContext.ivaPercent,
      discountPercent: appliedDiscount,
    });
  }, [invoiceType, completeRows, fiscalContext.ivaPercent, appliedDiscount]);

  const isGenericOverLimit = Boolean(
    selectedClient &&
      totals &&
      isGenericBillingClient(selectedClient) &&
      totals.totalCents > pesosToCents(fiscalContext.genericClientLimit),
  );

  const blockingError = isGenericOverLimit
    ? `El total supera el límite vigente de ${formatArs(fiscalContext.genericClientLimit)} para clientes sin identificación. Cargue los datos del cliente o reduzca el importe.`
    : null;

  const hasPartialRows = rows.some(isPartialDraftRow);
  const canSubmit = Boolean(
    selectedClient &&
      completeRows.length > 0 &&
      !hasPartialRows &&
      totals &&
      !isGenericOverLimit,
  );
  const validationHints = [
    !selectedClient ? "Asegúrese de seleccionar el cliente" : null,
    hasPartialRows
      ? "Asegúrese de rellenar todos los campos de Rubros"
      : null,
  ].filter((hint): hint is string => hint !== null);

  const isDraftDirty = useMemo(() => {
    if (createdInvoice) {
      return false;
    }

    if (selectedClient) {
      return true;
    }

    if (rows.length !== 1 || !isEmptyDraftRow(rows[0])) {
      return true;
    }

    if (discountInput.trim() !== "" || appliedDiscount > 0) {
      return true;
    }

    if (notes.trim() !== "") {
      return true;
    }

    if (paymentMethod !== "CONTADO") {
      return true;
    }

    return false;
  }, [
    appliedDiscount,
    createdInvoice,
    discountInput,
    notes,
    paymentMethod,
    rows,
    selectedClient,
  ]);

  const setDraftDirty = unsavedDraft?.setDraftDirty;
  const setInvoiceIssued = unsavedDraft?.setInvoiceIssued;

  useEffect(() => {
    setDraftDirty?.(isDraftDirty);
    return () => setDraftDirty?.(false);
  }, [isDraftDirty, setDraftDirty]);

  useEffect(() => {
    setInvoiceIssued?.(createdInvoice !== null);
    return () => setInvoiceIssued?.(false);
  }, [createdInvoice, setInvoiceIssued]);

  if (!allowOnAccount && paymentMethod === "CUENTA_CORRIENTE") {
    setPaymentMethod("CONTADO");
  }

  const handleRowChange = useCallback(
    (key: string, patch: Partial<InvoiceItemRow>) => {
      setRows((current) =>
        current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const addEmptyRow = useCallback((): string => {
    const existing = rowsRef.current.find(isEmptyDraftRow);
    if (existing) {
      return existing.key;
    }

    const row = createEmptyRow();
    setRows((current) => {
      if (current.some(isEmptyDraftRow)) {
        return current;
      }
      if (current.some((candidate) => candidate.key === row.key)) {
        return current;
      }
      return [...current, row];
    });
    return row.key;
  }, []);

  const handleAddRow = useCallback(() => {
    setRows((current) => [...current, createEmptyRow()]);
  }, []);

  const discardTrailingEmptyRows = useCallback(() => {
    setRows((current) => withoutTrailingEmptyDraftRows(current));
  }, []);

  const {
    afterRubroSelected,
    focusFirstRubro,
    leaveItemsSection,
    handleDescriptionKeyDown,
    handleQuantityKeyDown,
    handlePriceKeyDown,
  } = useInvoiceKeyboardFlow({
    rows,
    addEmptyRow,
    discardTrailingEmptyRows,
    focusClientPickerWhen:
      createdInvoice === null &&
      selectedClient === null &&
      !isCreateClientOpen &&
      !isConfirmOpen,
    enabled:
      createdInvoice === null &&
      !isConfirmOpen &&
      !isCreateClientOpen &&
      pendingLeave === null,
  });

  const handleRowSelectRubro = useCallback(
    (key: string, rubro: BillingRubroListItem) => {
      setRows((current) =>
        current.map((row) =>
          row.key === key
            ? {
                ...row,
                rubroId: rubro.id,
                rubroCode: rubro.code,
                rubroName: rubro.name,
                rubroQuery: `${rubro.code} — ${rubro.name}`,
                description: rubro.description ?? rubro.name,
              }
            : row,
        ),
      );
      afterRubroSelected(key);
    },
    [afterRubroSelected],
  );

  const handleRemoveRow = useCallback((key: string) => {
    setRows((current) =>
      current.length > 1 ? current.filter((row) => row.key !== key) : current,
    );
  }, []);

  const handleApplyDiscount = useCallback(() => {
    const parsed = Number(discountInput.trim().replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 99.99) {
      setAppliedDiscount(Math.round(parsed * 100) / 100);
    }
  }, [discountInput]);

  const handleClearDiscount = useCallback(() => {
    setAppliedDiscount(0);
    setDiscountInput("");
  }, []);

  const resetForm = useCallback(() => {
    setSelectedClient(null);
    setRows([createEmptyRow()]);
    setDiscountInput("");
    setAppliedDiscount(0);
    setPaymentMethod("CONTADO");
    setNotes("");
    setSubmitError(null);
    setIsConfirmOpen(false);
    setCreatedInvoice(null);
    setSuccessShareOpen(false);
    setHasPrintedInvoice(false);
    setPendingLeave(null);
    setIsLeavePrinting(false);
    setLeavePrintError(null);
  }, []);

  const performLeave = useCallback(
    (intent: UnprintedLeaveIntent) => {
      switch (intent.type) {
        case "reset":
          resetForm();
          return;
        case "navigate":
          setPendingLeave(null);
          sectionTransition?.beginNavigation(intent.href, {
            exact: intent.exact,
          });
          router.push(intent.href);
          return;
        default: {
          const exhaustive: never = intent;
          return exhaustive;
        }
      }
    },
    [resetForm, router, sectionTransition],
  );

  const requestLeaveIfUnprinted = useCallback(
    (intent: UnprintedLeaveIntent) => {
      if (hasPrintedInvoice) {
        performLeave(intent);
        return;
      }

      setLeavePrintError(null);
      setPendingLeave(intent);
    },
    [hasPrintedInvoice, performLeave],
  );

  const markActivity = useBillingDocumentActivity();

  const printCreatedInvoice = useCallback(async () => {
    if (!createdInvoice) {
      return;
    }

    setIsLeavePrinting(true);
    setLeavePrintError(null);
    try {
      await printInvoicePdf(createdInvoice.id);
      await markActivity("INVOICE", createdInvoice.id, "printed");
      setHasPrintedInvoice(true);
      setPendingLeave(null);
    } catch (caught) {
      setLeavePrintError(
        caught instanceof Error ? caught.message : "No se pudo imprimir.",
      );
    } finally {
      setIsLeavePrinting(false);
    }
  }, [createdInvoice, markActivity]);

  useEffect(() => {
    const setLeaveBlockHandler = unsavedDraft?.setLeaveBlockHandler;
    if (!setLeaveBlockHandler) {
      return;
    }

    if (!createdInvoice || hasPrintedInvoice) {
      setLeaveBlockHandler(null);
      return;
    }

    setLeaveBlockHandler((href, options) => {
      requestLeaveIfUnprinted({
        type: "navigate",
        href,
        exact: options?.exact,
      });
      return true;
    });

    return () => setLeaveBlockHandler(null);
  }, [
    createdInvoice,
    hasPrintedInvoice,
    requestLeaveIfUnprinted,
    unsavedDraft,
  ]);

  useEffect(() => {
    if (!createdInvoice || hasPrintedInvoice) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [createdInvoice, hasPrintedInvoice]);

  useBillingSuccessShortcuts(
    {
      onPrint: createdInvoice
        ? () => {
            void printCreatedInvoice();
          }
        : undefined,
      onCreateNew: () => requestLeaveIfUnprinted({ type: "reset" }),
      onList: () =>
        requestLeaveIfUnprinted({
          type: "navigate",
          href: BILLING_INVOICES_PATH,
          exact: true,
        }),
      onClose: () => requestLeaveIfUnprinted({ type: "reset" }),
    },
    createdInvoice !== null && pendingLeave === null,
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedClient || !canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createBillingInvoiceAction({
        clientId: selectedClient.id,
        items: completeRows.map((row) => ({
          rubroId: row.rubroId ?? "",
          description: row.description.trim() || null,
          quantity: parseRowQuantity(row) ?? 0,
          unitPrice: parseRowUnitPrice(row) ?? 0,
        })),
        discountPercent: appliedDiscount > 0 ? appliedDiscount : undefined,
        paymentMethod,
        notes: notes.trim() || null,
      });

      if (!result.success) {
        setSubmitError(result.error);
        return;
      }

      queryClient.setQueryData<BillingInvoiceListItem[]>(
        adminQueryKeys.billingInvoices(),
        (current) => prependBillingInvoiceInList(current, result.data),
      );
      void queryClient.fetchQuery({
        queryKey: adminQueryKeys.billingInvoices(),
        queryFn: fetchBillingInvoicesList,
        staleTime: 0,
      });
      router.refresh();
      setIsConfirmOpen(false);
      setCreatedInvoice(result.data);
      setHasPrintedInvoice(false);
      setPendingLeave(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedClient,
    canSubmit,
    completeRows,
    appliedDiscount,
    paymentMethod,
    notes,
    queryClient,
    router,
  ]);

  const requestCreateConfirm = useCallback(() => {
    if (!canSubmit || isSubmitting || !selectedClient || !invoiceType || !totals) {
      return;
    }
    setSubmitError(null);
    setIsConfirmOpen(true);
  }, [canSubmit, invoiceType, isSubmitting, selectedClient, totals]);

  const handleCreateClient = useCallback(
    async (values: ClientFormValues) => {
      setIsCreatingClient(true);
      setCreateClientError(null);

      try {
        const result = await createBillingClientAction({
          name: values.name,
          address: values.address || null,
          city: values.city || null,
          province: values.province || null,
          email: values.email || null,
          whatsapp: values.whatsapp || null,
          identificationType: values.identificationType,
          identificationNumber: values.identificationNumber || null,
          ivaCondition: values.ivaCondition,
          notes: values.notes || null,
        });

        if (!result.success) {
          setCreateClientError(result.error);
          return;
        }

        await queryClient.invalidateQueries({
          queryKey: adminQueryKeys.billingClients(),
        });
        setSelectedClient(result.data);
        setIsCreateClientOpen(false);
        setSubmitError(null);
        focusFirstRubro();
      } finally {
        setIsCreatingClient(false);
      }
    },
    [focusFirstRubro, queryClient],
  );

  const handleSelectUnidentifiedClient = useCallback(async () => {
    const existing = (clientsQuery.data ?? []).find((client) =>
      isCanonicalGenericBillingClient(client),
    );

    if (existing) {
      setSelectedClient(existing);
      setGenericClientError(null);
      setSubmitError(null);
      focusFirstRubro();
      return;
    }

    setIsSelectingGenericClient(true);
    setGenericClientError(null);

    try {
      const result = await ensureGenericBillingClientAction();

      if (!result.success) {
        setGenericClientError(result.error);
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: adminQueryKeys.billingClients(),
      });
      setSelectedClient(result.data);
      setSubmitError(null);
      focusFirstRubro();
    } finally {
      setIsSelectingGenericClient(false);
    }
  }, [clientsQuery.data, focusFirstRubro, queryClient]);

  if (createdInvoice) {
    return (
      <div className={styles.page}>
        <div className={styles.successCard} role="status">
          <div className={styles.successCardBody}>
            <CheckCircle2
              className={styles.successIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <h2 className={styles.successTitle}>
              Factura creada en modo prueba
            </h2>
            <p className={styles.successNumber}>{createdInvoice.invoiceNumber}</p>
            <p className={styles.successMeta}>
              {INVOICE_TYPE_LABELS[createdInvoice.invoiceType]} ·{" "}
              {createdInvoice.clientName} · Total{" "}
              {new Intl.NumberFormat("es-AR", {
                style: "currency",
                currency: "ARS",
                minimumFractionDigits: 2,
              }).format(createdInvoice.totalVisualRounded)}
            </p>
            <p className={styles.successHint}>
              La factura quedó guardada en el historial. No fue
              enviada a ARCA y no tiene validez fiscal.
            </p>
            <div className={styles.successActions}>
              <InvoiceDocumentActions
                invoice={createdInvoice}
                variant="card"
                cardActionOrder="success"
                shareOpen={successShareOpen}
                onShareOpenChange={setSuccessShareOpen}
                showPrintShortcut
                onPrinted={() => setHasPrintedInvoice(true)}
              />
              <Link
                href={BILLING_INVOICES_PATH}
                className={styles.successSecondaryLink}
                onClick={(event) => {
                  if (!hasPrintedInvoice) {
                    event.preventDefault();
                    requestLeaveIfUnprinted({
                      type: "navigate",
                      href: BILLING_INVOICES_PATH,
                      exact: true,
                    });
                    return;
                  }

                  sectionTransition?.beginNavigation(BILLING_INVOICES_PATH, {
                    exact: true,
                  });
                }}
              >
                <ReceiptText strokeWidth={ICON_STROKE} aria-hidden />
                Lista de facturas
                <kbd className={styles.shortcutKbd}>L</kbd>
              </Link>
              <button
                type="button"
                className={styles.submitButton}
                onClick={() => requestLeaveIfUnprinted({ type: "reset" })}
              >
                Crear nueva
                <kbd className={styles.shortcutKbd}>N</kbd>
              </button>
            </div>
          </div>
          <footer className={styles.successFooter}>
            <Info
              className={styles.successFooterIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <p className={styles.successFooterText}>
              Recuerde que si desea imprimir, descargar o compartir la factura
              puede ir a la lista de{" "}
              <Link
                href={BILLING_INVOICES_PATH}
                className={styles.successInvoicesLink}
                onClick={(event) => {
                  if (!hasPrintedInvoice) {
                    event.preventDefault();
                    requestLeaveIfUnprinted({
                      type: "navigate",
                      href: BILLING_INVOICES_PATH,
                      exact: true,
                    });
                    return;
                  }

                  sectionTransition?.beginNavigation(BILLING_INVOICES_PATH, {
                    exact: true,
                  });
                }}
              >
                <ReceiptText strokeWidth={ICON_STROKE} aria-hidden />
                Facturas
              </Link>
            </p>
          </footer>
        </div>
        {pendingLeave ? (
          <UnprintedInvoiceLeaveDialog
            isPrinting={isLeavePrinting}
            error={leavePrintError}
            leaveAction={resolveUnprintedLeaveAction(pendingLeave)}
            onPrint={() => {
              void printCreatedInvoice();
            }}
            onLeave={() => performLeave(pendingLeave)}
            onStay={() => {
              setPendingLeave(null);
              setLeavePrintError(null);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.testModeBanner} role="status">
        <AlertTriangle
          className={styles.testModeIcon}
          strokeWidth={ICON_STROKE}
          aria-hidden
        />
        Modo prueba activo. Las facturas creadas no se envían a ARCA y no
        tienen validez fiscal.
      </div>

      <div className={styles.contentLayout}>
        <div className={styles.mainColumn}>
          <InvoiceClientSection
            clients={clientsQuery.data ?? []}
            selectedClient={selectedClient}
            fiscalContext={fiscalContext}
            disabled={isSubmitting || isSelectingGenericClient}
            actionError={genericClientError}
            onSelect={(client) => {
              setSelectedClient(client);
              setGenericClientError(null);
              setSubmitError(null);
              focusFirstRubro();
            }}
            onClear={() => {
              setSelectedClient(null);
              setRows([createEmptyRow()]);
              setDiscountInput("");
              setAppliedDiscount(0);
              setPaymentMethod("CONTADO");
              setNotes("");
              setSubmitError(null);
              setGenericClientError(null);
            }}
            onCreateClient={() => {
              setCreateClientError(null);
              setIsCreateClientOpen(true);
            }}
            onSelectUnidentifiedClient={() => {
              void handleSelectUnidentifiedClient();
            }}
          />

          <InvoiceItemsSection
            rows={rows}
            rubros={activeRubros}
            ivaPercent={fiscalContext.ivaPercent}
            invoiceType={invoiceType}
            disabled={isSubmitting}
            onRowChange={handleRowChange}
            onRowSelectRubro={handleRowSelectRubro}
            onAddRow={handleAddRow}
            onRemoveRow={handleRemoveRow}
            onDescriptionKeyDown={handleDescriptionKeyDown}
            onQuantityKeyDown={handleQuantityKeyDown}
            onPriceKeyDown={handlePriceKeyDown}
            onLeaveItemsSection={leaveItemsSection}
          />

          <InvoiceSummarySection
            totals={totals}
            invoiceType={invoiceType}
            ivaPercent={fiscalContext.ivaPercent}
            discountInput={discountInput}
            appliedDiscount={appliedDiscount}
            paymentMethod={paymentMethod}
            allowOnAccount={allowOnAccount}
            notes={notes}
            canSubmit={canSubmit}
            isSubmitting={isSubmitting}
            blockingError={blockingError}
            submitError={submitError}
            validationHints={validationHints}
            onDiscountInputChange={setDiscountInput}
            onApplyDiscount={handleApplyDiscount}
            onClearDiscount={handleClearDiscount}
            onPaymentMethodChange={setPaymentMethod}
            onNotesChange={setNotes}
            onSubmit={requestCreateConfirm}
          />
        </div>
      </div>

      {isConfirmOpen &&
      selectedClient &&
      invoiceType &&
      totals ? (
        <InvoiceCreateConfirmModal
          clientName={selectedClient.name}
          invoiceType={invoiceType}
          rows={rows}
          totals={totals}
          ivaPercent={fiscalContext.ivaPercent}
          appliedDiscount={appliedDiscount}
          paymentMethod={paymentMethod}
          isSubmitting={isSubmitting}
          onConfirm={() => {
            void handleSubmit();
          }}
          onCancel={() => {
            if (!isSubmitting) {
              setIsConfirmOpen(false);
            }
          }}
        />
      ) : null}

      {isCreateClientOpen ? (
        <ClientFormModal
          mode="create"
          isBusy={isCreatingClient}
          error={createClientError}
          onClearError={() => setCreateClientError(null)}
          onClose={() => {
            if (!isCreatingClient) {
              setIsCreateClientOpen(false);
              setCreateClientError(null);
            }
          }}
          onSubmit={(values) => {
            void handleCreateClient(values);
          }}
        />
      ) : null}
    </div>
  );
}
