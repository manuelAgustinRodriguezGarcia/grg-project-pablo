import type {
  BillingIdentificationType,
  BillingInvoiceType,
  BillingPaymentStatus,
} from "@/generated/prisma/client";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import type { DashboardTopItem } from "@/features/billing/data/dashboardTypes";
import { formatCuit, formatDni, normalizeIdentificationDigits } from "@/shared/utils/identification";

export type ClientInvoiceSummary = {
  clientId: string;
  clientName: string;
  invoiceCount: number;
  billedAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
};

export type ClientDebtItem = {
  clientId: string;
  name: string;
  outstanding: number;
  invoicesCount: number;
  code: string;
  identification: string | null;
  whatsapp: string | null;
  email: string | null;
  lastPendingInvoiceNumber: string | null;
  lastPendingInvoiceDate: Date | null;
};

export type InvoiceListFilters = {
  query: string;
  invoiceType: "all" | BillingInvoiceType;
  paymentStatus: "all" | BillingPaymentStatus;
  fromDate: string;
  toDate: string;
};

export function issuedAtToIsoDateOnly(issuedAt: Date | string): string {
  const date = issuedAt instanceof Date ? issuedAt : new Date(issuedAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function invoiceMatchesDateRange(
  invoice: Pick<BillingInvoiceListItem, "issuedAt">,
  fromDate: string,
  toDate: string,
): boolean {
  const issuedDate = issuedAtToIsoDateOnly(invoice.issuedAt);

  if (fromDate && issuedDate < fromDate) {
    return false;
  }

  if (toDate && issuedDate > toDate) {
    return false;
  }

  return true;
}

export function formatInvoiceIdentification(
  identificationType: BillingIdentificationType,
  identificationNumber: string | null,
): string | null {
  if (!identificationNumber) {
    return null;
  }

  switch (identificationType) {
    case "CUIT":
      return formatCuit(identificationNumber);
    case "DNI":
      return formatDni(identificationNumber);
    case "NINGUNO":
      return identificationNumber;
    default: {
      const _exhaustive: never = identificationType;
      return _exhaustive;
    }
  }
}

export function invoiceMatchesSearch(
  invoice: BillingInvoiceListItem,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
  if (!normalizedQuery) {
    return true;
  }

  const queryDigits = normalizeIdentificationDigits(normalizedQuery);
  const identification = formatInvoiceIdentification(
    invoice.clientIdentificationType,
    invoice.clientIdentificationNumber,
  );

  const matchesText =
    invoice.invoiceNumber.toLocaleLowerCase("es-AR").includes(normalizedQuery) ||
    invoice.clientName.toLocaleLowerCase("es-AR").includes(normalizedQuery) ||
    invoice.clientCode.toLocaleLowerCase("es-AR").includes(normalizedQuery) ||
    (identification !== null &&
      identification.toLocaleLowerCase("es-AR").includes(normalizedQuery));

  const matchesIdentification =
    queryDigits.length > 0 &&
    invoice.clientIdentificationNumber !== null &&
    invoice.clientIdentificationNumber.includes(queryDigits);

  return matchesText || matchesIdentification;
}

export function prependBillingInvoiceInList(
  invoices: BillingInvoiceListItem[] | undefined,
  invoice: BillingInvoiceListItem,
): BillingInvoiceListItem[] | undefined {
  if (!invoices) {
    return invoices;
  }

  if (invoices.some((item) => item.id === invoice.id)) {
    return invoices;
  }

  return [invoice, ...invoices];
}

export function filterInvoiceList(
  invoices: BillingInvoiceListItem[],
  filters: InvoiceListFilters,
): BillingInvoiceListItem[] {
  return invoices.filter((invoice) => {
    if (filters.invoiceType !== "all" && invoice.invoiceType !== filters.invoiceType) {
      return false;
    }

    if (
      filters.paymentStatus !== "all" &&
      invoice.paymentStatus !== filters.paymentStatus
    ) {
      return false;
    }

    if (!invoiceMatchesDateRange(invoice, filters.fromDate, filters.toDate)) {
      return false;
    }

    return invoiceMatchesSearch(invoice, filters.query);
  });
}

export function buildClientInvoiceSummaryMap(
  invoices: BillingInvoiceListItem[],
): Map<string, ClientInvoiceSummary> {
  const summaries = new Map<string, ClientInvoiceSummary>();

  for (const invoice of invoices) {
    if (!invoice.clientId) {
      continue;
    }

    const current = summaries.get(invoice.clientId) ?? {
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      invoiceCount: 0,
      billedAmount: 0,
      unpaidCount: 0,
      unpaidAmount: 0,
    };

    current.invoiceCount += 1;
    current.billedAmount += invoice.totalVisualRounded;

    if (
      invoice.paymentMethod === "CUENTA_CORRIENTE" &&
      invoice.outstandingAmount > 0
    ) {
      current.unpaidCount += 1;
      current.unpaidAmount += invoice.outstandingAmount;
    }

    summaries.set(invoice.clientId, current);
  }

  return summaries;
}

export function applyLiveClientNames(
  summaries: Map<string, ClientInvoiceSummary>,
  clients: readonly { id: string; name: string }[],
): Map<string, ClientInvoiceSummary> {
  if (clients.length === 0 || summaries.size === 0) {
    return summaries;
  }

  const liveNames = new Map(
    clients.map((client) => [client.id, client.name] as const),
  );
  const next = new Map<string, ClientInvoiceSummary>();

  for (const [clientId, summary] of summaries) {
    const liveName = liveNames.get(clientId);
    next.set(
      clientId,
      liveName && liveName !== summary.clientName
        ? { ...summary, clientName: liveName }
        : summary,
    );
  }

  return next;
}

export function listTopClientsByBilling(
  summaries: Iterable<ClientInvoiceSummary>,
  limit = 5,
): DashboardTopItem[] {
  return [...summaries]
    .filter((summary) => summary.billedAmount > 0)
    .sort((left, right) => right.billedAmount - left.billedAmount)
    .slice(0, limit)
    .map((summary) => ({
      name: summary.clientName,
      amount: summary.billedAmount,
      invoiceCount: summary.invoiceCount,
    }));
}

export function listTopRubrosByClient(
  invoices: readonly BillingInvoiceListItem[],
  limit = 3,
): DashboardTopItem[] {
  const map = new Map<string, { name: string; amount: number; invoiceIds: Set<string> }>();

  for (const invoice of invoices) {
    for (const item of invoice.items ?? []) {
      const key = item.rubroId ?? item.rubroName;
      const existing = map.get(key);
      if (existing) {
        existing.amount += item.lineTotal;
        existing.invoiceIds.add(invoice.id);
      } else {
        map.set(key, { name: item.rubroName, amount: item.lineTotal, invoiceIds: new Set([invoice.id]) });
      }
    }
  }

  return [...map.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((entry) => ({
      name: entry.name,
      amount: entry.amount,
      invoiceCount: entry.invoiceIds.size,
    }));
}

export function listDebtorClients(
  summaries: Iterable<ClientInvoiceSummary>,
): ClientDebtItem[] {
  return [...summaries]
    .filter((summary) => summary.unpaidAmount > 0)
    .sort((left, right) => right.unpaidAmount - left.unpaidAmount)
    .map((summary) => ({
      clientId: summary.clientId,
      name: summary.clientName,
      outstanding: summary.unpaidAmount,
      invoicesCount: summary.unpaidCount,
      code: "",
      identification: null,
      whatsapp: null,
      email: null,
      lastPendingInvoiceNumber: null,
      lastPendingInvoiceDate: null,
    }));
}

export type DebtorSortOrder = "asc" | "desc";

export function isPendingAccountInvoice(
  invoice: BillingInvoiceListItem,
): boolean {
  return (
    invoice.paymentMethod === "CUENTA_CORRIENTE" &&
    invoice.fiscalStatus !== "ANULADA_NC" &&
    invoice.paymentStatus !== "ANULADA" &&
    invoice.outstandingAmount > 0
  );
}

export function buildDebtorClients(
  invoices: readonly BillingInvoiceListItem[],
): ClientDebtItem[] {
  const grouped = new Map<
    string,
    {
      item: ClientDebtItem;
      lastPending: BillingInvoiceListItem | null;
    }
  >();

  for (const invoice of invoices) {
    if (!invoice.clientId || !isPendingAccountInvoice(invoice)) {
      continue;
    }

    const current = grouped.get(invoice.clientId);
    const identification = formatInvoiceIdentification(
      invoice.clientIdentificationType,
      invoice.clientIdentificationNumber,
    );

    if (!current) {
      grouped.set(invoice.clientId, {
        item: {
          clientId: invoice.clientId,
          name: invoice.clientName,
          outstanding: invoice.outstandingAmount,
          invoicesCount: 1,
          code: invoice.clientCode,
          identification,
          whatsapp: invoice.clientWhatsapp,
          email: invoice.clientEmail,
          lastPendingInvoiceNumber: invoice.invoiceNumber,
          lastPendingInvoiceDate: invoice.issuedAt,
        },
        lastPending: invoice,
      });
      continue;
    }

    current.item.outstanding += invoice.outstandingAmount;
    current.item.invoicesCount += 1;
    if (
      !current.lastPending ||
      new Date(invoice.issuedAt).getTime() >
        new Date(current.lastPending.issuedAt).getTime()
    ) {
      current.lastPending = invoice;
      current.item.lastPendingInvoiceNumber = invoice.invoiceNumber;
      current.item.lastPendingInvoiceDate = invoice.issuedAt;
    }
  }

  return [...grouped.values()]
    .map((entry) => entry.item)
    .sort((left, right) => right.outstanding - left.outstanding);
}

export function debtorMatchesSearch(
  debtor: ClientDebtItem,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
  if (!normalizedQuery) {
    return true;
  }

  const queryDigits = normalizeIdentificationDigits(normalizedQuery);
  const matchesText =
    debtor.name.toLocaleLowerCase("es-AR").includes(normalizedQuery) ||
    debtor.code.toLocaleLowerCase("es-AR").includes(normalizedQuery) ||
    (debtor.identification !== null &&
      debtor.identification.toLocaleLowerCase("es-AR").includes(normalizedQuery));
  const matchesIdentification =
    queryDigits.length > 0 &&
    (debtor.identification ?? "").replace(/\D+/g, "").includes(queryDigits);

  return matchesText || matchesIdentification;
}

export function filterDebtorClients(
  debtors: readonly ClientDebtItem[],
  query: string,
  sort: DebtorSortOrder,
): ClientDebtItem[] {
  const filtered = debtors.filter((debtor) =>
    debtorMatchesSearch(debtor, query),
  );
  return [...filtered].sort((left, right) =>
    sort === "asc"
      ? left.outstanding - right.outstanding
      : right.outstanding - left.outstanding,
  );
}

export function clientHasDebt(
  summaries: Map<string, ClientInvoiceSummary>,
  clientId: string,
): boolean {
  return (summaries.get(clientId)?.unpaidAmount ?? 0) > 0;
}

export function invoiceCanIssueReceipt(
  invoice: Pick<
    BillingInvoiceListItem,
    | "clientId"
    | "paymentMethod"
    | "outstandingAmount"
    | "paymentStatus"
    | "fiscalStatus"
  >,
): boolean {
  return (
    Boolean(invoice.clientId) &&
    invoice.paymentMethod === "CUENTA_CORRIENTE" &&
    invoice.fiscalStatus !== "ANULADA_NC" &&
    invoice.paymentStatus !== "PAGA" &&
    invoice.paymentStatus !== "ANULADA" &&
    invoice.outstandingAmount > 0
  );
}

export function invoiceCanIssueCreditNote(
  invoice: Pick<BillingInvoiceListItem, "creditNoteCap" | "fiscalStatus">,
): boolean {
  return invoice.fiscalStatus !== "ANULADA_NC" && invoice.creditNoteCap > 0;
}

export function invoiceCanIssueDebitNote(
  invoice: Pick<
    BillingInvoiceListItem,
    "paymentMethod" | "outstandingAmount" | "paymentStatus" | "fiscalStatus"
  >,
): boolean {
  return (
    invoice.fiscalStatus !== "ANULADA_NC" &&
    invoice.paymentMethod === "CUENTA_CORRIENTE" &&
    invoice.paymentStatus !== "PAGA" &&
    invoice.paymentStatus !== "ANULADA" &&
    invoice.outstandingAmount > 0
  );
}

export function paymentStatusTone(
  status: BillingPaymentStatus,
): "ok" | "partial" | "inactive" | "void" {
  switch (status) {
    case "PAGA":
      return "ok";
    case "PARCIALMENTE_PAGA":
      return "partial";
    case "IMPAGA":
      return "inactive";
    case "ANULADA":
      return "void";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export type InvoicePaymentStatusFilter = "all" | BillingPaymentStatus;

export function parsePaymentStatusFilter(
  value: string | null | undefined,
): InvoicePaymentStatusFilter {
  switch (value) {
    case "IMPAGA":
    case "PARCIALMENTE_PAGA":
    case "PAGA":
    case "ANULADA":
      return value;
    case "all":
    case "":
    case null:
    case undefined:
      return "all";
    default:
      return "all";
  }
}
