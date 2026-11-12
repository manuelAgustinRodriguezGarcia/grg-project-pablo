import type { BillingFiscalEnvironment } from "@/generated/prisma/client";

export type StatisticsMoneyView = {
  net: string;
  vat: string;
  total: string;
  roundingGap: string;
};

export type StatisticsCountsView = {
  invoiceCount: number;
  creditNoteCount: number;
  debitNoteCount: number;
  documentCount: number;
};

export type StatisticsShareReason = "ZERO_TOTAL" | "NEGATIVE_TOTAL" | null;

export type StatisticsMonthAmount = {
  year: number;
  month: number;
  total: string;
  documentCount: number;
};

export type StatisticsPeriodView = {
  mode: "month" | "year" | "custom";
  from: string;
  to: string;
};

export type StatisticsComparisonView = {
  period: StatisticsPeriodView;
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  delta: {
    totals: StatisticsMoneyView;
    counts: StatisticsCountsView;
  };
  monthly: StatisticsMonthAmount[];
};

export type StatisticsReconciliationView = {
  general: StatisticsMoneyView;
  invoices: StatisticsMoneyView;
  notes: StatisticsMoneyView;
  clients: StatisticsMoneyView;
  rubros: StatisticsMoneyView;
  unassigned: StatisticsMoneyView;
  adjustments: StatisticsMoneyView;
  clientsMinusGeneral: StatisticsMoneyView;
  distributionMinusGeneral: StatisticsMoneyView;
  clientsMatchGeneral: boolean;
  distributionMatchGeneral: boolean;
};

export type StatisticsSummaryResponse = {
  environment: BillingFiscalEnvironment;
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  monthly: StatisticsMonthAmount[];
  reconciliation: StatisticsReconciliationView;
  comparison: StatisticsComparisonView | null;
};

export type StatisticsRowComparison = {
  totals: StatisticsMoneyView;
  deltaTotals: StatisticsMoneyView;
};

export type StatisticsClientRow = {
  rank: number;
  key: string;
  clientId: string | null;
  identity: "client-id" | "historical-snapshot";
  clientCode: string;
  clientName: string;
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  sharePercent: string | null;
  shareUnavailableReason: StatisticsShareReason;
  comparison: StatisticsRowComparison | null;
};

export type StatisticsClientEntity = {
  found: boolean;
  key: string;
  clientId: string | null;
  identity: "client-id" | "historical-snapshot" | null;
  clientCode: string | null;
  clientName: string | null;
  rank: number | null;
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  sharePercent: string | null;
  shareUnavailableReason: StatisticsShareReason;
  monthly: StatisticsMonthAmount[];
  comparison: {
    totals: StatisticsMoneyView;
    deltaTotals: StatisticsMoneyView;
    monthly: StatisticsMonthAmount[];
  } | null;
};

export type StatisticsClientsResponse = {
  environment: BillingFiscalEnvironment;
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  ranking: {
    totalGroups: number;
    returned: number;
    rows: StatisticsClientRow[];
  };
  entity: StatisticsClientEntity | null;
};

export type StatisticsRubroRow = {
  rank: number;
  key: string;
  rubroId: string | null;
  identity: "rubro-id" | "historical-snapshot";
  rubroCode: string;
  rubroName: string;
  totals: StatisticsMoneyView;
  lineCount: number;
  quantity: string;
  invoiceCount: number;
  sharePercent: string | null;
  shareUnavailableReason: StatisticsShareReason;
  comparison: StatisticsRowComparison | null;
};

export type StatisticsUnassignedView = {
  key: "unassigned";
  label: string;
  totals: StatisticsMoneyView;
  invoiceCount: number;
  lineCount: number;
  sharePercent: string | null;
  shareUnavailableReason: StatisticsShareReason;
};

export type StatisticsAdjustmentsView = {
  key: "adjustments";
  label: string;
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  sharePercent: string | null;
  shareUnavailableReason: StatisticsShareReason;
};

export type StatisticsRubroEntity =
  | {
      found: boolean;
      kind: "rubro";
      key: string;
      rubroId: string | null;
      identity: "rubro-id" | "historical-snapshot" | null;
      rubroCode: string | null;
      rubroName: string | null;
      rank: number | null;
      totals: StatisticsMoneyView;
      lineCount: number;
      quantity: string;
      invoiceCount: number;
      sharePercent: string | null;
      shareUnavailableReason: StatisticsShareReason;
      monthly: StatisticsMonthAmount[];
      comparison: {
        totals: StatisticsMoneyView;
        monthly: StatisticsMonthAmount[];
      } | null;
    }
  | {
      found: true;
      kind: "adjustments";
      key: string;
      totals: StatisticsMoneyView;
      counts: StatisticsCountsView;
      monthly: StatisticsMonthAmount[];
      comparison: {
        totals: StatisticsMoneyView;
        monthly: StatisticsMonthAmount[];
      } | null;
    }
  | {
      found: true;
      kind: "unassigned";
      key: string;
      totals: StatisticsMoneyView;
      invoiceCount: number;
      lineCount: number;
      monthly: StatisticsMonthAmount[];
      comparison: {
        totals: StatisticsMoneyView;
        monthly: StatisticsMonthAmount[];
      } | null;
    };

export type StatisticsYearClientSlice = {
  key: string;
  clientId: string | null;
  identity: "client-id" | "historical-snapshot";
  clientCode: string;
  clientName: string;
  labelIssuedAt: number;
  labelNumber: string;
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
};

export type StatisticsYearRubroSlice = {
  key: string;
  rubroId: string | null;
  identity: "rubro-id" | "historical-snapshot";
  rubroCode: string;
  rubroName: string;
  labelIssuedAt: number;
  labelSortOrder: number;
  labelNumber: string;
  totals: StatisticsMoneyView;
  lineCount: number;
  quantity: string;
  invoiceCount: number;
};

export type StatisticsYearUnassigned = {
  totals: StatisticsMoneyView;
  invoiceCount: number;
  lineCount: number;
};

export type StatisticsYearAdjustments = {
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
};

export type StatisticsYearMonth = {
  year: number;
  month: number;
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  invoices: StatisticsMoneyView;
  notes: StatisticsMoneyView;
  creditNotes: StatisticsMoneyView;
  debitNotes: StatisticsMoneyView;
  clients: StatisticsYearClientSlice[];
  rubros: StatisticsYearRubroSlice[];
  unassigned: StatisticsYearUnassigned;
  adjustments: StatisticsYearAdjustments;
};

export type StatisticsYearNote = {
  id: string;
  kind: "CREDIT" | "DEBIT";
  issuedOn: string;
  month: number;
  noteNumber: string;
  clientKey: string;
  clientName: string;
  totals: StatisticsMoneyView;
  invoiceId: string;
  invoiceNumber: string;
};

export type StatisticsYearResponse = {
  environment: BillingFiscalEnvironment;
  year: number;
  months: StatisticsYearMonth[];
  notes: StatisticsYearNote[];
};

export type StatisticsRubrosResponse = {
  environment: BillingFiscalEnvironment;
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  reconciliation: StatisticsReconciliationView;
  ranking: {
    totalGroups: number;
    returned: number;
    rows: StatisticsRubroRow[];
  };
  unassigned: StatisticsUnassignedView;
  adjustments: StatisticsAdjustmentsView;
  entity: StatisticsRubroEntity | null;
};
