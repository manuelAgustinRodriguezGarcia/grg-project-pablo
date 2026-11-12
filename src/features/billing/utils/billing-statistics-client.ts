import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import type {
  StatisticsAdjustmentsView,
  StatisticsClientEntity,
  StatisticsClientRow,
  StatisticsClientsResponse,
  StatisticsComparisonView,
  StatisticsCountsView,
  StatisticsMoneyView,
  StatisticsMonthAmount,
  StatisticsReconciliationView,
  StatisticsRowComparison,
  StatisticsRubroEntity,
  StatisticsRubroRow,
  StatisticsRubrosResponse,
  StatisticsShareReason,
  StatisticsSummaryResponse,
  StatisticsUnassignedView,
  StatisticsYearAdjustments,
  StatisticsYearClientSlice,
  StatisticsYearMonth,
  StatisticsYearNote,
  StatisticsYearResponse,
  StatisticsYearRubroSlice,
  StatisticsYearUnassigned,
} from "@/features/billing/types/billing-statistics.types";

const DECIMAL_2 = /^-?\d+\.\d{2}$/;
const ENVIRONMENTS = new Set<BillingFiscalEnvironment>([
  "MODO_PRUEBA",
  "HOMOLOGACION",
  "PRODUCCION",
]);
const PERIOD_MODES = new Set(["month", "year", "custom"]);

export class StatisticsRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StatisticsRequestError";
    this.status = status;
  }
}

const CONTRACT = "La respuesta de estadísticas no tiene el formato esperado.";

function contract(): StatisticsRequestError {
  return new StatisticsRequestError(CONTRACT, 200);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertMoney(value: unknown): StatisticsMoneyView {
  if (!isRecord(value)) {
    throw contract();
  }

  const { net, vat, total, roundingGap } = value;
  if (
    typeof net !== "string" ||
    typeof vat !== "string" ||
    typeof total !== "string" ||
    typeof roundingGap !== "string" ||
    !DECIMAL_2.test(net) ||
    !DECIMAL_2.test(vat) ||
    !DECIMAL_2.test(total) ||
    !DECIMAL_2.test(roundingGap)
  ) {
    throw contract();
  }

  return { net, vat, total, roundingGap };
}

function assertCounts(value: unknown): StatisticsCountsView {
  if (!isRecord(value)) {
    throw contract();
  }

  const counts = {
    invoiceCount: value.invoiceCount,
    creditNoteCount: value.creditNoteCount,
    debitNoteCount: value.debitNoteCount,
    documentCount: value.documentCount,
  };

  if (
    !Number.isInteger(counts.invoiceCount) ||
    !Number.isInteger(counts.creditNoteCount) ||
    !Number.isInteger(counts.debitNoteCount) ||
    !Number.isInteger(counts.documentCount)
  ) {
    throw contract();
  }

  return counts as StatisticsCountsView;
}

function assertShare(row: Record<string, unknown>): {
  sharePercent: string | null;
  shareUnavailableReason: StatisticsShareReason;
} {
  const { sharePercent, shareUnavailableReason } = row;
  if (sharePercent !== null && (typeof sharePercent !== "string" || !DECIMAL_2.test(sharePercent))) {
    throw contract();
  }
  if (
    shareUnavailableReason !== null &&
    shareUnavailableReason !== "ZERO_TOTAL" &&
    shareUnavailableReason !== "NEGATIVE_TOTAL"
  ) {
    throw contract();
  }

  return {
    sharePercent,
    shareUnavailableReason,
  };
}

function assertMonth(value: unknown): StatisticsMonthAmount {
  if (!isRecord(value) || !Number.isInteger(value.year) || !Number.isInteger(value.month)) {
    throw contract();
  }

  const totals = assertMoney(value.totals);
  const documentCount = isRecord(value.counts) && Number.isInteger(value.counts.documentCount)
    ? Number(value.counts.documentCount)
    : 0;

  return {
    year: Number(value.year),
    month: Number(value.month),
    total: totals.total,
    documentCount,
  };
}

function assertMonths(value: unknown): StatisticsMonthAmount[] {
  if (!Array.isArray(value)) {
    throw contract();
  }
  return value.map((point) => assertMonth(point));
}

function assertEnvironment(
  value: unknown,
  expected: BillingFiscalEnvironment,
): BillingFiscalEnvironment {
  if (typeof value !== "string" || !ENVIRONMENTS.has(value as BillingFiscalEnvironment)) {
    throw contract();
  }
  if (value !== expected) {
    throw new StatisticsRequestError(
      "Las estadísticas corresponden a otro ambiente fiscal. Actualizá la página.",
      409,
    );
  }
  return expected;
}

function assertComparison(value: unknown): StatisticsComparisonView | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value) || !isRecord(value.period) || !isRecord(value.delta)) {
    throw contract();
  }
  if (typeof value.period.mode !== "string" || !PERIOD_MODES.has(value.period.mode)) {
    throw contract();
  }
  if (typeof value.period.from !== "string" || typeof value.period.to !== "string") {
    throw contract();
  }

  return {
    period: {
      mode: value.period.mode as StatisticsComparisonView["period"]["mode"],
      from: value.period.from,
      to: value.period.to,
    },
    totals: assertMoney(value.totals),
    counts: assertCounts(value.counts),
    delta: {
      totals: assertMoney(value.delta.totals),
      counts: assertCounts(value.delta.counts),
    },
    monthly: assertMonths(value.monthly),
  };
}

function assertReconciliation(value: unknown): StatisticsReconciliationView {
  if (!isRecord(value)) {
    throw contract();
  }

  return {
    general: assertMoney(value.general),
    invoices: assertMoney(value.invoices),
    notes: assertMoney(value.notes),
    clients: assertMoney(value.clients),
    rubros: assertMoney(value.rubros),
    unassigned: assertMoney(value.unassigned),
    adjustments: assertMoney(value.adjustments),
    clientsMinusGeneral: assertMoney(value.clientsMinusGeneral),
    distributionMinusGeneral: assertMoney(value.distributionMinusGeneral),
    clientsMatchGeneral: assertBoolean(value.clientsMatchGeneral),
    distributionMatchGeneral: assertBoolean(value.distributionMatchGeneral),
  };
}

function assertBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw contract();
  }
  return value;
}

function assertRowComparison(value: unknown): StatisticsRowComparison | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw contract();
  }
  return {
    totals: assertMoney(value.totals),
    deltaTotals: assertMoney(value.deltaTotals),
  };
}

function assertRanking<T>(value: unknown, mapRow: (row: Record<string, unknown>) => T): {
  totalGroups: number;
  returned: number;
  rows: T[];
} {
  if (!isRecord(value) || !Array.isArray(value.rows)) {
    throw contract();
  }
  if (!Number.isInteger(value.totalGroups) || !Number.isInteger(value.returned)) {
    throw contract();
  }

  return {
    totalGroups: Number(value.totalGroups),
    returned: Number(value.returned),
    rows: value.rows.map((row) => {
      if (!isRecord(row)) {
        throw contract();
      }
      return mapRow(row);
    }),
  };
}

export function parseStatisticsSummary(
  payload: unknown,
  environment: BillingFiscalEnvironment,
): StatisticsSummaryResponse {
  if (!isRecord(payload)) {
    throw contract();
  }

  return {
    environment: assertEnvironment(payload.environment, environment),
    totals: assertMoney(payload.totals),
    counts: assertCounts(payload.counts),
    monthly: assertMonths(payload.monthly),
    reconciliation: assertReconciliation(payload.reconciliation),
    comparison: assertComparison(payload.comparison),
  };
}

function assertClientRow(row: Record<string, unknown>): StatisticsClientRow {
  if (typeof row.key !== "string" || !Number.isInteger(row.rank)) {
    throw contract();
  }
  if (row.identity !== "client-id" && row.identity !== "historical-snapshot") {
    throw contract();
  }
  if (typeof row.clientName !== "string" || typeof row.clientCode !== "string") {
    throw contract();
  }
  if (row.clientId !== null && typeof row.clientId !== "string") {
    throw contract();
  }

  return {
    rank: Number(row.rank),
    key: row.key,
    clientId: row.clientId,
    identity: row.identity,
    clientCode: row.clientCode,
    clientName: row.clientName,
    totals: assertMoney(row.totals),
    counts: assertCounts(row.counts),
    ...assertShare(row),
    comparison: assertRowComparison(row.comparison),
  };
}

function assertClientEntity(value: unknown): StatisticsClientEntity | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value) || typeof value.key !== "string" || typeof value.found !== "boolean") {
    throw contract();
  }
  if (
    value.identity !== null &&
    value.identity !== "client-id" &&
    value.identity !== "historical-snapshot"
  ) {
    throw contract();
  }

  const comparison = value.comparison === null
    ? null
    : isRecord(value.comparison)
      ? {
          totals: assertMoney(value.comparison.totals),
          deltaTotals: assertMoney(value.comparison.deltaTotals),
          monthly: assertMonths(value.comparison.monthly),
        }
      : null;

  if (value.comparison !== null && comparison === null) {
    throw contract();
  }

  return {
    found: value.found,
    key: value.key,
    clientId: typeof value.clientId === "string" ? value.clientId : null,
    identity: value.identity,
    clientCode: typeof value.clientCode === "string" ? value.clientCode : null,
    clientName: typeof value.clientName === "string" ? value.clientName : null,
    rank: Number.isInteger(value.rank) ? Number(value.rank) : null,
    totals: assertMoney(value.totals),
    counts: assertCounts(value.counts),
    ...assertShare(value),
    monthly: assertMonths(value.monthly),
    comparison,
  };
}

export function parseStatisticsClients(
  payload: unknown,
  environment: BillingFiscalEnvironment,
): StatisticsClientsResponse {
  if (!isRecord(payload)) {
    throw contract();
  }

  return {
    environment: assertEnvironment(payload.environment, environment),
    totals: assertMoney(payload.totals),
    counts: assertCounts(payload.counts),
    ranking: assertRanking(payload.ranking, assertClientRow),
    entity: assertClientEntity(payload.entity),
  };
}

function assertRubroRow(row: Record<string, unknown>): StatisticsRubroRow {
  if (typeof row.key !== "string" || !Number.isInteger(row.rank)) {
    throw contract();
  }
  if (row.identity !== "rubro-id" && row.identity !== "historical-snapshot") {
    throw contract();
  }
  if (typeof row.rubroName !== "string" || typeof row.rubroCode !== "string") {
    throw contract();
  }
  if (!Number.isInteger(row.lineCount) || !Number.isInteger(row.invoiceCount)) {
    throw contract();
  }
  if (typeof row.quantity !== "string" || !DECIMAL_2.test(row.quantity)) {
    throw contract();
  }

  return {
    rank: Number(row.rank),
    key: row.key,
    rubroId: typeof row.rubroId === "string" ? row.rubroId : null,
    identity: row.identity,
    rubroCode: row.rubroCode,
    rubroName: row.rubroName,
    totals: assertMoney(row.totals),
    lineCount: Number(row.lineCount),
    quantity: row.quantity,
    invoiceCount: Number(row.invoiceCount),
    ...assertShare(row),
    comparison: assertRowComparison(row.comparison),
  };
}

function assertUnassigned(value: unknown): StatisticsUnassignedView {
  if (!isRecord(value)) {
    throw contract();
  }
  if (!Number.isInteger(value.invoiceCount) || !Number.isInteger(value.lineCount)) {
    throw contract();
  }

  return {
    key: "unassigned",
    label: typeof value.label === "string" ? value.label : "Sin rubro asignable",
    totals: assertMoney(value.totals),
    invoiceCount: Number(value.invoiceCount),
    lineCount: Number(value.lineCount),
    ...assertShare(value),
  };
}

function assertAdjustments(value: unknown): StatisticsAdjustmentsView {
  if (!isRecord(value)) {
    throw contract();
  }

  return {
    key: "adjustments",
    label: typeof value.label === "string" ? value.label : "Ajustes sin rubro",
    totals: assertMoney(value.totals),
    counts: assertCounts(value.counts),
    ...assertShare(value),
  };
}

function assertRubroEntity(value: unknown): StatisticsRubroEntity | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value) || typeof value.key !== "string") {
    throw contract();
  }

  const comparison = value.comparison === null
    ? null
    : isRecord(value.comparison)
      ? {
          totals: assertMoney(value.comparison.totals),
          monthly: assertMonths(value.comparison.monthly),
        }
      : null;

  if (value.comparison !== null && comparison === null) {
    throw contract();
  }

  if (value.kind === "adjustments") {
    return {
      found: true,
      kind: "adjustments",
      key: value.key,
      totals: assertMoney(value.totals),
      counts: assertCounts(value.counts),
      monthly: assertMonths(value.monthly),
      comparison,
    };
  }

  if (value.kind === "unassigned") {
    if (!Number.isInteger(value.invoiceCount) || !Number.isInteger(value.lineCount)) {
      throw contract();
    }
    return {
      found: true,
      kind: "unassigned",
      key: value.key,
      totals: assertMoney(value.totals),
      invoiceCount: Number(value.invoiceCount),
      lineCount: Number(value.lineCount),
      monthly: assertMonths(value.monthly),
      comparison,
    };
  }

  if (value.kind !== "rubro" || typeof value.found !== "boolean") {
    throw contract();
  }
  if (
    value.identity !== null &&
    value.identity !== "rubro-id" &&
    value.identity !== "historical-snapshot"
  ) {
    throw contract();
  }
  if (!Number.isInteger(value.lineCount) || !Number.isInteger(value.invoiceCount)) {
    throw contract();
  }
  if (typeof value.quantity !== "string" || !DECIMAL_2.test(value.quantity)) {
    throw contract();
  }

  return {
    found: value.found,
    kind: "rubro",
    key: value.key,
    rubroId: typeof value.rubroId === "string" ? value.rubroId : null,
    identity: value.identity,
    rubroCode: typeof value.rubroCode === "string" ? value.rubroCode : null,
    rubroName: typeof value.rubroName === "string" ? value.rubroName : null,
    rank: Number.isInteger(value.rank) ? Number(value.rank) : null,
    totals: assertMoney(value.totals),
    lineCount: Number(value.lineCount),
    quantity: value.quantity,
    invoiceCount: Number(value.invoiceCount),
    ...assertShare(value),
    monthly: assertMonths(value.monthly),
    comparison,
  };
}

export function parseStatisticsRubros(
  payload: unknown,
  environment: BillingFiscalEnvironment,
): StatisticsRubrosResponse {
  if (!isRecord(payload)) {
    throw contract();
  }

  return {
    environment: assertEnvironment(payload.environment, environment),
    totals: assertMoney(payload.totals),
    counts: assertCounts(payload.counts),
    reconciliation: assertReconciliation(payload.reconciliation),
    ranking: assertRanking(payload.ranking, assertRubroRow),
    unassigned: assertUnassigned(payload.unassigned),
    adjustments: assertAdjustments(payload.adjustments),
    entity: assertRubroEntity(payload.entity),
  };
}

async function readPayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function errorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  return fallback;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertYearClient(value: unknown): StatisticsYearClientSlice {
  if (!isRecord(value) || typeof value.key !== "string") {
    throw contract();
  }
  if (value.identity !== "client-id" && value.identity !== "historical-snapshot") {
    throw contract();
  }
  if (typeof value.clientName !== "string" || typeof value.clientCode !== "string") {
    throw contract();
  }
  if (typeof value.labelNumber !== "string" || typeof value.labelIssuedAt !== "number") {
    throw contract();
  }
  if (value.clientId !== null && typeof value.clientId !== "string") {
    throw contract();
  }

  return {
    key: value.key,
    clientId: typeof value.clientId === "string" ? value.clientId : null,
    identity: value.identity,
    clientCode: value.clientCode,
    clientName: value.clientName,
    labelIssuedAt: value.labelIssuedAt,
    labelNumber: value.labelNumber,
    totals: assertMoney(value.totals),
    counts: assertCounts(value.counts),
  };
}

function assertYearRubro(value: unknown): StatisticsYearRubroSlice {
  if (!isRecord(value) || typeof value.key !== "string") {
    throw contract();
  }
  if (value.identity !== "rubro-id" && value.identity !== "historical-snapshot") {
    throw contract();
  }
  if (typeof value.rubroName !== "string" || typeof value.rubroCode !== "string") {
    throw contract();
  }
  if (typeof value.quantity !== "string" || !DECIMAL_2.test(value.quantity)) {
    throw contract();
  }
  if (
    !Number.isInteger(value.lineCount) ||
    !Number.isInteger(value.invoiceCount) ||
    !Number.isInteger(value.labelSortOrder) ||
    typeof value.labelIssuedAt !== "number" ||
    typeof value.labelNumber !== "string"
  ) {
    throw contract();
  }

  return {
    key: value.key,
    rubroId: typeof value.rubroId === "string" ? value.rubroId : null,
    identity: value.identity,
    rubroCode: value.rubroCode,
    rubroName: value.rubroName,
    labelIssuedAt: value.labelIssuedAt,
    labelSortOrder: Number(value.labelSortOrder),
    labelNumber: value.labelNumber,
    totals: assertMoney(value.totals),
    lineCount: Number(value.lineCount),
    quantity: value.quantity,
    invoiceCount: Number(value.invoiceCount),
  };
}

function assertYearUnassigned(value: unknown): StatisticsYearUnassigned {
  if (!isRecord(value) || !Number.isInteger(value.invoiceCount) || !Number.isInteger(value.lineCount)) {
    throw contract();
  }

  return {
    totals: assertMoney(value.totals),
    invoiceCount: Number(value.invoiceCount),
    lineCount: Number(value.lineCount),
  };
}

function assertYearAdjustments(value: unknown): StatisticsYearAdjustments {
  if (!isRecord(value)) {
    throw contract();
  }

  return {
    totals: assertMoney(value.totals),
    counts: assertCounts(value.counts),
  };
}

function assertYearMonth(value: unknown, year: number): StatisticsYearMonth {
  if (!isRecord(value) || value.year !== year || !Number.isInteger(value.month)) {
    throw contract();
  }
  if (!Array.isArray(value.clients) || !Array.isArray(value.rubros)) {
    throw contract();
  }

  return {
    year,
    month: Number(value.month),
    totals: assertMoney(value.totals),
    counts: assertCounts(value.counts),
    invoices: assertMoney(value.invoices),
    notes: assertMoney(value.notes),
    creditNotes: assertMoney(value.creditNotes),
    debitNotes: assertMoney(value.debitNotes),
    clients: value.clients.map((client) => assertYearClient(client)),
    rubros: value.rubros.map((rubro) => assertYearRubro(rubro)),
    unassigned: assertYearUnassigned(value.unassigned),
    adjustments: assertYearAdjustments(value.adjustments),
  };
}

function assertYearNote(value: unknown): StatisticsYearNote {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.noteNumber !== "string") {
    throw contract();
  }
  if (value.kind !== "CREDIT" && value.kind !== "DEBIT") {
    throw contract();
  }
  if (typeof value.issuedOn !== "string" || !ISO_DATE.test(value.issuedOn)) {
    throw contract();
  }
  if (!Number.isInteger(value.month) || typeof value.clientName !== "string" || typeof value.clientKey !== "string") {
    throw contract();
  }
  if (typeof value.invoiceId !== "string" || typeof value.invoiceNumber !== "string") {
    throw contract();
  }

  return {
    id: value.id,
    kind: value.kind,
    issuedOn: value.issuedOn,
    month: Number(value.month),
    noteNumber: value.noteNumber,
    clientKey: value.clientKey,
    clientName: value.clientName,
    totals: assertMoney(value.totals),
    invoiceId: value.invoiceId,
    invoiceNumber: value.invoiceNumber,
  };
}

export function parseStatisticsYear(
  payload: unknown,
  environment: BillingFiscalEnvironment,
): StatisticsYearResponse {
  if (!isRecord(payload) || !Number.isInteger(payload.year) || !Array.isArray(payload.months)) {
    throw contract();
  }
  if (!Array.isArray(payload.notes)) {
    throw contract();
  }

  const year = Number(payload.year);
  const months = payload.months.map((month) => assertYearMonth(month, year));
  if (months.length !== 12 || months.some((month, index) => month.month !== index + 1)) {
    throw contract();
  }

  return {
    environment: assertEnvironment(payload.environment, environment),
    year,
    months,
    notes: payload.notes.map((note) => assertYearNote(note)),
  };
}

export async function fetchBillingStatisticsYear(
  year: number,
  environment: BillingFiscalEnvironment,
  signal: AbortSignal,
): Promise<StatisticsYearResponse> {
  let response: Response;
  try {
    response = await fetch(`/api/admin/billing/statistics/year?year=${year}`, {
      credentials: "include",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    throw new StatisticsRequestError("No se pudo conectar con el servidor.", 0);
  }

  if (!response.ok) {
    const payload = await readPayload(response);
    if (response.status === 401) {
      throw new StatisticsRequestError("La sesión venció. Volvé a iniciar sesión.", 401);
    }
    if (response.status === 403) {
      throw new StatisticsRequestError("No tenés permiso para ver las estadísticas.", 403);
    }
    throw new StatisticsRequestError(
      errorMessage(payload, "No se pudieron cargar las estadísticas."),
      response.status,
    );
  }

  return parseStatisticsYear(await readPayload(response), environment);
}

export async function fetchBillingStatistics(
  resource: "summary" | "clients" | "rubros",
  search: string,
  environment: BillingFiscalEnvironment,
  signal: AbortSignal,
): Promise<StatisticsSummaryResponse | StatisticsClientsResponse | StatisticsRubrosResponse> {
  const path = resource === "summary"
    ? "/api/admin/billing/statistics"
    : `/api/admin/billing/statistics/${resource}`;
  const url = search ? `${path}?${search}` : path;

  let response: Response;
  try {
    response = await fetch(url, { credentials: "include", cache: "no-store", signal });
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    throw new StatisticsRequestError("No se pudo conectar con el servidor.", 0);
  }

  if (!response.ok) {
    const payload = await readPayload(response);
    if (response.status === 401) {
      throw new StatisticsRequestError("La sesión venció. Volvé a iniciar sesión.", 401);
    }
    if (response.status === 403) {
      throw new StatisticsRequestError("No tenés permiso para ver las estadísticas.", 403);
    }
    throw new StatisticsRequestError(
      errorMessage(payload, "No se pudieron cargar las estadísticas."),
      response.status,
    );
  }

  const payload = await readPayload(response);
  switch (resource) {
    case "summary":
      return parseStatisticsSummary(payload, environment);
    case "clients":
      return parseStatisticsClients(payload, environment);
    case "rubros":
      return parseStatisticsRubros(payload, environment);
    default: {
      const unexpected: never = resource;
      throw new StatisticsRequestError(unexpected, 500);
    }
  }
}
