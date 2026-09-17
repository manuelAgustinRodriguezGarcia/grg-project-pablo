export type DashboardQuickLink = {
  href: string;
  label: string;
};

/** Datos reales provenientes de catálogos / listas de precios. */
export type DashboardCatalogSummary = {
  name: string;
  updatedAtLabel: string;
  href: string;
};

export type DashboardPriceListSummary = {
  name: string;
  updatedAtLabel: string;
  href: string;
};

export type DashboardKpiTone = "blue" | "green" | "amber" | "red";

export type DashboardKpi = {
  id: string;
  label: string;
  value: string;
  secondary: string;
  tone: DashboardKpiTone;
  trendPositive?: boolean;
};

export type DashboardDonutSlice = {
  key: string;
  label: string;
  amount: number;
  percent: number;
  color: string;
  invoiceCount?: number;
};

export type DashboardTopItem = {
  name: string;
  amount: number;
  invoiceCount?: number;
};

export type DashboardUnpaidInvoice = {
  id: string;
  number: string;
  clientName: string;
  total: number;
  dueLabel: string;
};

export type DashboardHubKpi = {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean | null;
};

export type DashboardMonthTrend = {
  text: string;
  isUp: boolean | null;
};
