import type {
  DashboardDonutSlice,
  DashboardHubKpi,
  DashboardKpi,
  DashboardMonthTrend,
  DashboardTopItem,
  DashboardUnpaidInvoice,
} from "@/features/billing/data/dashboardTypes";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import { formatArs } from "@/features/billing/utils/format-ars";
import {
  buildClientInvoiceSummaryMap,
  invoiceMatchesDateRange,
  listDebtorClients,
  listTopClientsByBilling,
  type ClientDebtItem,
} from "@/features/billing/utils/invoice-list";

const UNPAID_INVOICE_LIMIT = 5;
const TOP_RANK_LIMIT = 5;
const PENDING_ISSUED_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
});

export type CalendarYearMonth = {
  year: number;
  month: number;
};

export type BillingDashboardMetrics = {
  monthLabel: string;
  previousMonthLabel: string;
  billedAmount: number;
  invoiceCount: number;
  outstandingAmount: number;
  unpaidCount: number;
  invoiceTypeSlices: DashboardDonutSlice[];
  invoiceTypeTotal: number;
  collectionSlices: DashboardDonutSlice[];
  collectionTotal: number;
  topClients: DashboardTopItem[];
  topRubros: DashboardTopItem[];
  unpaidInvoices: DashboardUnpaidInvoice[];
  debtorClients: ClientDebtItem[];
  revenueKpi: DashboardKpi;
  unpaidKpi: DashboardKpi;
  hubKpis: {
    invoiced: DashboardHubKpi;
    receipts: DashboardHubKpi;
    outstanding: DashboardHubKpi;
  };
};

export function isCountableInvoice(
  invoice: Pick<BillingInvoiceListItem, "fiscalStatus">,
): boolean {
  return invoice.fiscalStatus !== "ANULADA_NC";
}

export function yearMonthFromDate(date: Date): CalendarYearMonth {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

export function shiftYearMonth(
  yearMonth: CalendarYearMonth,
  deltaMonths: number,
): CalendarYearMonth {
  const shifted = new Date(yearMonth.year, yearMonth.month - 1 + deltaMonths, 1);
  return yearMonthFromDate(shifted);
}

export function formatMonthName(yearMonth: CalendarYearMonth): string {
  const raw = new Intl.DateTimeFormat("es-AR", {
    month: "long",
  }).format(new Date(yearMonth.year, yearMonth.month - 1, 1));

  return raw.charAt(0).toLocaleUpperCase("es-AR") + raw.slice(1);
}

export function formatMonthLabel(yearMonth: CalendarYearMonth): string {
  return `${formatMonthName(yearMonth)} ${yearMonth.year}`;
}

export function calendarMonthDateRange(yearMonth: CalendarYearMonth): {
  fromDate: string;
  toDate: string;
} {
  const lastDay = new Date(yearMonth.year, yearMonth.month, 0).getDate();
  return {
    fromDate: `${yearMonth.year}-${pad2(yearMonth.month)}-01`,
    toDate: `${yearMonth.year}-${pad2(yearMonth.month)}-${pad2(lastDay)}`,
  };
}

export function invoicesInCalendarMonth(
  invoices: readonly BillingInvoiceListItem[],
  yearMonth: CalendarYearMonth,
): BillingInvoiceListItem[] {
  const range = calendarMonthDateRange(yearMonth);
  return invoices.filter((invoice) =>
    invoiceMatchesDateRange(invoice, range.fromDate, range.toDate),
  );
}

export function countableInvoices(
  invoices: readonly BillingInvoiceListItem[],
): BillingInvoiceListItem[] {
  return invoices.filter(isCountableInvoice);
}

export function sumBilledAmount(
  invoices: readonly BillingInvoiceListItem[],
): number {
  return invoices.reduce((sum, invoice) => sum + invoice.totalVisualRounded, 0);
}

export function sumOutstandingAmount(
  invoices: readonly BillingInvoiceListItem[],
): number {
  return invoices.reduce((sum, invoice) => sum + invoice.outstandingAmount, 0);
}

export function buildInvoiceTypeSlices(
  invoices: readonly BillingInvoiceListItem[],
): DashboardDonutSlice[] {
  const typeA = invoices.filter((invoice) => invoice.invoiceType === "A");
  const typeB = invoices.filter((invoice) => invoice.invoiceType === "B");
  const amountA = sumBilledAmount(typeA);
  const amountB = sumBilledAmount(typeB);
  const percents = percentsThatSumTo100([amountA, amountB]);

  return [
    {
      key: "a",
      label: "Factura A",
      amount: amountA,
      percent: percents[0] ?? 0,
      color: "#062b5f",
      invoiceCount: typeA.length,
    },
    {
      key: "b",
      label: "Factura B",
      amount: amountB,
      percent: percents[1] ?? 0,
      color: "#4a96dc",
      invoiceCount: typeB.length,
    },
  ];
}

export function buildCollectionSlices(
  invoices: readonly BillingInvoiceListItem[],
): { slices: DashboardDonutSlice[]; total: number } {
  const billed = sumBilledAmount(invoices);
  const pending = sumOutstandingAmount(invoices);
  const collected = Math.max(0, billed - pending);
  const percents = percentsThatSumTo100([collected, pending]);

  return {
    total: billed,
    slices: [
      {
        key: "collected",
        label: "Cobrado",
        amount: collected,
        percent: percents[0] ?? 0,
        color: "#031b3d",
      },
      {
        key: "pending",
        label: "Pendiente",
        amount: pending,
        percent: percents[1] ?? 0,
        color: "#4a96dc",
      },
    ],
  };
}

export function listTopRubrosByBilling(
  invoices: readonly BillingInvoiceListItem[],
  limit = TOP_RANK_LIMIT,
): DashboardTopItem[] {
  const grouped = new Map<
    string,
    { name: string; amount: number; invoiceIds: Set<string> }
  >();

  for (const invoice of invoices) {
    for (const item of invoice.items) {
      const key = item.rubroId ?? item.rubroName;
      const current = grouped.get(key) ?? {
        name: item.rubroName,
        amount: 0,
        invoiceIds: new Set<string>(),
      };
      current.amount += item.lineTotal;
      current.invoiceIds.add(invoice.id);
      grouped.set(key, current);
    }
  }

  return [...grouped.values()]
    .filter((entry) => entry.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, limit)
    .map((entry) => ({
      name: entry.name,
      amount: entry.amount,
      invoiceCount: entry.invoiceIds.size,
    }));
}

export function listUnpaidInvoicesForDashboard(
  invoices: readonly BillingInvoiceListItem[],
  limit = UNPAID_INVOICE_LIMIT,
): DashboardUnpaidInvoice[] {
  return [...invoices]
    .filter((invoice) => invoice.outstandingAmount > 0)
    .sort((left, right) => right.outstandingAmount - left.outstandingAmount)
    .slice(0, limit)
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.invoiceNumber,
      clientName: invoice.clientName,
      total: invoice.outstandingAmount,
      dueLabel: `Pendiente desde ${PENDING_ISSUED_FORMATTER.format(new Date(invoice.issuedAt))}.`,
    }));
}

export function formatAmountTrend(
  current: number,
  previous: number,
  previousMonthLabel: string,
): DashboardMonthTrend {
  if (previous <= 0 && current <= 0) {
    return {
      text: `Sin movimiento vs. ${previousMonthLabel}`,
      isUp: null,
    };
  }

  if (previous <= 0) {
    return {
      text: `Sin base de comparación vs. ${previousMonthLabel}`,
      isUp: true,
    };
  }

  const deltaPercent = ((current - previous) / previous) * 100;
  const formatted = Math.abs(deltaPercent).toLocaleString("es-AR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  const isUp = deltaPercent > 0;
  const arrow = isUp ? "↑" : deltaPercent < 0 ? "↓" : "=";

  return {
    text: `${arrow} ${formatted}% vs. ${previousMonthLabel}`,
    isUp: deltaPercent === 0 ? null : isUp,
  };
}

export function formatCountTrend(
  current: number,
  previous: number,
  previousMonthLabel: string,
): DashboardMonthTrend {
  if (previous === 0 && current === 0) {
    return {
      text: `Sin comprobantes vs. ${previousMonthLabel}`,
      isUp: null,
    };
  }

  if (previous === 0) {
    return {
      text: `Nuevo vs. ${previousMonthLabel}`,
      isUp: true,
    };
  }

  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";

  return {
    text: `${sign}${delta} vs. ${previousMonthLabel}`,
    isUp: delta === 0 ? null : delta > 0,
  };
}

export function buildBillingDashboardMetrics(
  invoices: readonly BillingInvoiceListItem[],
  now: Date = new Date(),
): BillingDashboardMetrics {
  const currentMonth = yearMonthFromDate(now);
  const previousMonth = shiftYearMonth(currentMonth, -1);
  const monthLabel = formatMonthLabel(currentMonth);
  const previousMonthLabel = formatMonthLabel(previousMonth);

  const countable = countableInvoices(invoices);
  const monthInvoices = invoicesInCalendarMonth(countable, currentMonth);
  const previousInvoices = invoicesInCalendarMonth(countable, previousMonth);

  const billedAmount = sumBilledAmount(monthInvoices);
  const previousBilledAmount = sumBilledAmount(previousInvoices);
  const invoiceCount = monthInvoices.length;
  const previousInvoiceCount = previousInvoices.length;
  const outstandingAmount = sumOutstandingAmount(countable);
  const unpaidInvoices = countable.filter(
    (invoice) => invoice.outstandingAmount > 0,
  );
  const unpaidCount = unpaidInvoices.length;

  const invoiceTypeSlices = buildInvoiceTypeSlices(monthInvoices);
  const collection = buildCollectionSlices(monthInvoices);
  const billedTrend = formatAmountTrend(
    billedAmount,
    previousBilledAmount,
    previousMonthLabel,
  );
  const countTrend = formatCountTrend(
    invoiceCount,
    previousInvoiceCount,
    previousMonthLabel,
  );
  const clientSummaries = buildClientInvoiceSummaryMap(monthInvoices);
  const allSummaries = buildClientInvoiceSummaryMap(countable);

  const revenueKpi: DashboardKpi = {
    id: "revenue",
    label: "Facturación del mes",
    value: formatArs(billedAmount),
    secondary: billedTrend.text,
    tone: "blue",
    trendPositive: billedTrend.isUp === true,
  };
  const unpaidKpi: DashboardKpi = {
    id: "unpaid",
    label: "Facturas impagas",
    value: formatArs(outstandingAmount),
    secondary:
      unpaidCount === 1
        ? "1 factura pendiente"
        : `${unpaidCount} facturas pendientes`,
    tone: "red",
  };

  return {
    monthLabel,
    previousMonthLabel,
    billedAmount,
    invoiceCount,
    outstandingAmount,
    unpaidCount,
    invoiceTypeSlices,
    invoiceTypeTotal: billedAmount,
    collectionSlices: collection.slices,
    collectionTotal: collection.total,
    topClients: listTopClientsByBilling(clientSummaries.values(), TOP_RANK_LIMIT),
    topRubros: listTopRubrosByBilling(monthInvoices, TOP_RANK_LIMIT),
    unpaidInvoices: listUnpaidInvoicesForDashboard(unpaidInvoices),
    debtorClients: listDebtorClients(allSummaries.values()),
    revenueKpi,
    unpaidKpi,
    hubKpis: {
      invoiced: toHubKpi(
        "Facturado del mes",
        formatArs(billedAmount),
        billedTrend,
      ),
      receipts: toHubKpi(
        "Comprobantes emitidos",
        String(invoiceCount),
        countTrend,
      ),
      outstanding: {
        label: "Saldo pendiente",
        value: formatArs(outstandingAmount),
        trend:
          unpaidCount === 1
            ? "1 factura con saldo"
            : `${unpaidCount} facturas con saldo`,
        trendUp: null,
      },
    },
  };
}

function toHubKpi(
  label: string,
  value: string,
  trend: DashboardMonthTrend,
): DashboardHubKpi {
  return {
    label,
    value,
    trend: trend.text,
    trendUp: trend.isUp,
  };
}

function percentsThatSumTo100(amounts: readonly number[]): number[] {
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (total <= 0) {
    return amounts.map(() => 0);
  }

  const floored = amounts.map((amount) =>
    Math.floor((amount / total) * 100),
  );
  const remainder = 100 - floored.reduce((sum, value) => sum + value, 0);
  if (remainder === 0) {
    return floored;
  }

  const richestIndex = amounts.reduce(
    (bestIndex, amount, index) =>
      amount > (amounts[bestIndex] ?? 0) ? index : bestIndex,
    0,
  );
  const adjusted = [...floored];
  adjusted[richestIndex] = (adjusted[richestIndex] ?? 0) + remainder;
  return adjusted;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
