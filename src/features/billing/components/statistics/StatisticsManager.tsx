"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import { useReportAdminSectionReady } from "@/features/admin/components/AdminSectionTransition";
import { StatisticsBreakdown, type StatisticsRankItem } from "@/features/billing/components/statistics/StatisticsBreakdown";
import { StatisticsConclusions } from "@/features/billing/components/statistics/StatisticsConclusions";
import { StatisticsEntityDetail } from "@/features/billing/components/statistics/StatisticsEntityDetail";
import { StatisticsEvolution } from "@/features/billing/components/statistics/StatisticsEvolution";
import { StatisticsKpis } from "@/features/billing/components/statistics/StatisticsKpis";
import { StatisticsMonthComparison } from "@/features/billing/components/statistics/StatisticsMonthComparison";
import { StatisticsNotes } from "@/features/billing/components/statistics/StatisticsNotes";
import { StatisticsPeriodBar } from "@/features/billing/components/statistics/StatisticsPeriodBar";
import { StatisticsShiftSummary } from "@/features/billing/components/statistics/StatisticsShiftSummary";
import { useBillingStatisticsYear } from "@/features/billing/hooks/useBillingStatisticsQueries";
import {
  countLabel,
  formatStatisticsQuantity,
  type EntityPanelModel,
} from "@/features/billing/utils/billing-statistics-display";
import {
  combineStatisticsYear,
  type StatisticsRankedClient,
  type StatisticsRankedRubro,
} from "@/features/billing/utils/billing-statistics-combine";
import type { StatisticsNavAnalysis } from "@/features/billing/utils/billing-statistics-navigation";
import { statisticsYearOptions } from "@/features/billing/utils/billing-statistics-period";
import {
  changeSelectionYear,
  createMonthSelection,
  describeSelectedMonths,
  toggleFullYear,
  toggleSelectedMonth,
  type StatisticsMonthSelection,
} from "@/features/billing/utils/billing-statistics-selection";
import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsManagerProps = {
  fiscalEnvironment: BillingFiscalEnvironment;
  initialYear: number;
  initialMonth: number;
  initialSection?: "clients" | "rubros";
  initialAnalysis?: StatisticsNavAnalysis | null;
};

function selectionCaption(selection: StatisticsMonthSelection): string {
  if (selection.months.length === 12) {
    return `Evolución de ${selection.year}. El año completo forma parte del análisis.`;
  }

  const verb = selection.months.length === 1 ? "forma" : "forman";
  return `Evolución de ${selection.year}. ${describeSelectedMonths(selection)} ${verb} parte del análisis.`;
}

function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error && error.message
    ? error.message
    : "No se pudieron cargar las estadísticas.";

  return (
    <div className={styles.errorBox} role="alert">
      <p>{message}</p>
      <button type="button" className={styles.retryButton} onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

function clientItems(rows: readonly StatisticsRankedClient[]): StatisticsRankItem[] {
  return rows.map((row) => ({
    key: row.key,
    rank: row.rank,
    name: row.name,
    code: row.code,
    historical: row.historical,
    total: row.totals.total,
    sharePercent: row.sharePercent,
    shareUnavailableReason: row.shareUnavailableReason,
    secondary: countLabel(row.counts.documentCount, "comprobante", "comprobantes"),
  }));
}

function rubroItems(rows: readonly StatisticsRankedRubro[]): StatisticsRankItem[] {
  return rows.map((row) => ({
    key: row.key,
    rank: row.rank,
    name: row.name,
    code: row.code,
    historical: row.historical,
    total: row.totals.total,
    sharePercent: row.sharePercent,
    shareUnavailableReason: row.shareUnavailableReason,
    secondary: `${countLabel(row.lineCount, "línea", "líneas")} · ${formatStatisticsQuantity(row.quantity)} unidades`,
  }));
}

function missingPanel(title: string, missing: string): EntityPanelModel {
  return {
    found: false,
    title,
    code: null,
    historical: false,
    total: "0.00",
    net: "0.00",
    vat: "0.00",
    sharePercent: null,
    shareUnavailableReason: null,
    secondary: "",
    monthly: [],
    comparisonTotal: null,
    comparisonDelta: null,
    comparisonMonthly: null,
    missing,
  };
}

function clientPanel(client: StatisticsRankedClient): EntityPanelModel {
  return {
    found: true,
    title: client.name,
    code: client.code,
    historical: client.historical,
    total: client.totals.total,
    net: client.totals.net,
    vat: client.totals.vat,
    sharePercent: client.sharePercent,
    shareUnavailableReason: client.shareUnavailableReason,
    secondary: countLabel(client.counts.documentCount, "comprobante", "comprobantes"),
    monthly: client.monthly,
    comparisonTotal: null,
    comparisonDelta: null,
    comparisonMonthly: null,
    missing: "No hay movimientos de este cliente en los meses seleccionados.",
  };
}

function rubroPanel(rubro: StatisticsRankedRubro): EntityPanelModel {
  return {
    found: true,
    title: rubro.name,
    code: rubro.code,
    historical: rubro.historical,
    total: rubro.totals.total,
    net: rubro.totals.net,
    vat: rubro.totals.vat,
    sharePercent: rubro.sharePercent,
    shareUnavailableReason: rubro.shareUnavailableReason,
    secondary: `${countLabel(rubro.lineCount, "línea", "líneas")} · ${formatStatisticsQuantity(rubro.quantity)} unidades · ${countLabel(rubro.invoiceCount, "factura", "facturas")}`,
    monthly: rubro.monthly,
    comparisonTotal: null,
    comparisonDelta: null,
    comparisonMonthly: null,
    missing: "No hay movimientos de este rubro en los meses seleccionados.",
  };
}

export function StatisticsManager({
  fiscalEnvironment,
  initialYear,
  initialMonth,
  initialSection = "clients",
  initialAnalysis = null,
}: StatisticsManagerProps) {
  useReportAdminSectionReady(true);
  const analysisRequest = useRef(initialAnalysis);
  const today = useMemo(
    () => ({ year: initialYear, month: initialMonth }),
    [initialYear, initialMonth],
  );
  const [selection, setSelection] = useState<StatisticsMonthSelection>(() =>
    createMonthSelection(initialYear, initialMonth),
  );
  const [section, setSection] = useState<"clients" | "rubros">(initialSection);
  const [clientKey, setClientKey] = useState<string | null>(null);
  const [rubroKey, setRubroKey] = useState<string | null>(null);
  const [showAllClients, setShowAllClients] = useState(false);
  const [showAllRubros, setShowAllRubros] = useState(false);
  const years = statisticsYearOptions(initialYear, [selection.year]);
  const yearQuery = useBillingStatisticsYear({
    environment: fiscalEnvironment,
    year: selection.year,
    enabled: true,
  });
  const pack = yearQuery.data?.year === selection.year ? yearQuery.data : null;
  const view = useMemo(
    () => (pack ? combineStatisticsYear(pack, selection.months, today) : null),
    [pack, selection.months, today],
  );
  const waitingForYear = !pack && (yearQuery.isPending || yearQuery.isFetching);

  function toggleMonth(month: number) {
    setSelection((current) => toggleSelectedMonth(current, month));
    setShowAllClients(false);
    setShowAllRubros(false);
  }

  useEffect(() => {
    const analysis = analysisRequest.current;
    if (!analysis || !view) {
      return;
    }

    const node = document.getElementById(`statistics-analysis-${analysis}`);
    if (!node) {
      return;
    }

    analysisRequest.current = null;
    node.scrollIntoView({ block: "start" });
  }, [view, section]);

  const selectedClient = view?.clients.find((client) => client.key === clientKey) ?? null;
  const selectedRubro = view?.rubros.find((rubro) => rubro.key === rubroKey) ?? null;
  const caption = view
    ? selectionCaption(selection)
    : `Evolución de ${selection.year}.`;

  return (
    <div
      className={styles.page}
      data-statistics-root
      data-statistics-section={section === "clients" ? "clientes" : "rubros"}
      data-statistics-analysis={initialAnalysis ?? undefined}
    >
      <header className={styles.header}>
        <h1 className={styles.title}>Estadísticas</h1>
        <p className={styles.subtitle}>Analizá la facturación por clientes, rubros y períodos.</p>
      </header>
      <p className={styles.srOnly} aria-live="polite">
        {view
          ? `Estadísticas de ${describeSelectedMonths(selection)}`
          : selection.months.length === 0
            ? "Seleccioná uno o más meses para consultar sus estadísticas."
            : waitingForYear
              ? `Cargando estadísticas de ${selection.year}`
              : "Estadísticas"}
      </p>

      <section className={styles.filters} aria-label="Filtros de período">
        <StatisticsPeriodBar
          selection={selection}
          yearOptions={years}
          refreshing={yearQuery.isFetching}
          onToggleMonth={toggleMonth}
          onToggleFullYear={() => {
            setSelection((current) => toggleFullYear(current));
            setShowAllClients(false);
            setShowAllRubros(false);
          }}
          onChangeYear={(year) => {
            setSelection((current) => changeSelectionYear(current, year));
            setClientKey(null);
            setRubroKey(null);
          }}
          onRefresh={() => {
            void yearQuery.refetch();
          }}
        />
      </section>

      <div className={styles.results} aria-busy={waitingForYear}>
        {selection.months.length === 0 ? (
          <p className={styles.empty} role="status">
            Seleccioná uno o más meses para consultar sus estadísticas.
          </p>
        ) : null}

        {selection.months.length > 0 && waitingForYear ? (
          <div className={styles.kpiGrid} aria-hidden>
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
          </div>
        ) : null}

        {selection.months.length > 0 && yearQuery.isError ? (
          <QueryError error={yearQuery.error} onRetry={() => void yearQuery.refetch()} />
        ) : null}

        {view ? (
          <>
            <StatisticsKpis
              totals={view.totals}
              counts={view.counts}
              averageTotal={view.averageTotal}
              monthCount={view.selectedMonths.length}
            />
            <StatisticsEvolution
              monthly={view.chartMonths}
              selectedMonths={selection.months}
              caption={caption}
              onToggleMonth={toggleMonth}
            />
            <StatisticsMonthComparison view={view} />
            <section className={styles.section} aria-label="Detalle por clientes y rubros">
              <div className={styles.sectionSwitch} role="tablist" aria-label="Estadísticas por">
                <button
                  type="button"
                  role="tab"
                  aria-selected={section === "clients"}
                  className={`${styles.monthButton} ${section === "clients" ? styles.monthButtonActive : ""}`}
                  onClick={() => setSection("clients")}
                >
                  Clientes
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={section === "rubros"}
                  className={`${styles.monthButton} ${section === "rubros" ? styles.monthButtonActive : ""}`}
                  onClick={() => setSection("rubros")}
                >
                  Rubros
                </button>
              </div>

              {section === "clients" ? (
                <StatisticsBreakdown
                  noun="clientes"
                  items={clientItems(view.clients)}
                  totalGroups={view.clients.length}
                  selectedKey={clientKey}
                  expanded={showAllClients}
                  onToggleExpanded={() => setShowAllClients((current) => !current)}
                  onSelect={(key) => setClientKey((current) => current === key ? null : key)}
                  entity={clientKey ? (
                    <StatisticsEntityDetail
                      panel={selectedClient
                        ? clientPanel(selectedClient)
                        : missingPanel("Cliente", "No hay movimientos de este cliente en los meses seleccionados.")}
                      onClose={() => setClientKey(null)}
                    />
                  ) : null}
                  context={(
                    <StatisticsShiftSummary
                      noun="cliente"
                      leaders={view.clientLeaders}
                      increases={view.clientIncreases}
                      decreases={view.clientDecreases}
                    />
                  )}
                />
              ) : (
                <StatisticsBreakdown
                  noun="rubros"
                  items={rubroItems(view.rubros)}
                  totalGroups={view.rubros.length}
                  selectedKey={rubroKey}
                  expanded={showAllRubros}
                  onToggleExpanded={() => setShowAllRubros((current) => !current)}
                  onSelect={(key) => setRubroKey((current) => current === key ? null : key)}
                  entity={rubroKey ? (
                    <StatisticsEntityDetail
                      panel={selectedRubro
                        ? rubroPanel(selectedRubro)
                        : missingPanel("Rubro", "No hay movimientos de este rubro en los meses seleccionados.")}
                      onClose={() => setRubroKey(null)}
                    />
                  ) : null}
                  context={(
                    <StatisticsShiftSummary
                      noun="rubro"
                      leaders={view.rubroLeaders}
                      increases={view.rubroIncreases}
                      decreases={view.rubroDecreases}
                    />
                  )}
                />
              )}
            </section>
            <StatisticsConclusions conclusions={view.conclusions} />
            <StatisticsNotes
              creditCount={view.counts.creditNoteCount}
              debitCount={view.counts.debitNoteCount}
              creditNotes={view.creditNotes}
              debitNotes={view.debitNotes}
              notes={view.notes}
              reconciliation={view.reconciliation}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
