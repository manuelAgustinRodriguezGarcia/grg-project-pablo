"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import { useReportAdminSectionReady } from "@/features/admin/components/AdminSectionTransition";
import { StatisticsBreakdown, type StatisticsRankItem } from "@/features/billing/components/statistics/StatisticsBreakdown";
import { StatisticsConclusions } from "@/features/billing/components/statistics/StatisticsConclusions";
import {
  STATISTICS_SELECTED_ENTITY_ID,
  StatisticsEntityDetail,
} from "@/features/billing/components/statistics/StatisticsEntityDetail";
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
import {
  statisticsInvoicedYearOptions,
  statisticsSelectableYear,
} from "@/features/billing/utils/billing-statistics-period";
import {
  changeSelectionYear,
  createMonthSelection,
  describeSelectedMonths,
  isFullYearSelection,
  toggleFullYear,
  toggleSelectedMonth,
  type StatisticsMonthSelection,
} from "@/features/billing/utils/billing-statistics-selection";
import { BarChart3, BookUser, ICON_STROKE, Tags } from "@/shared/icons";
import styles from "@/features/billing/styles/Statistics.module.scss";

const STATISTICS_SKELETON_RANKS = [
  styles.skeletonRankNameWide,
  styles.skeletonRankNameMedium,
  styles.skeletonRankNameShort,
  styles.skeletonRankNameMedium,
] as const;

const STATISTICS_SKELETON_BARS = ["92%", "74%", "58%", "41%"] as const;

const STATISTICS_SKELETON_KPIS = [
  {
    label: styles.skeletonLabelWide,
    value: styles.skeletonValueWide,
    secondary: styles.skeletonSecondaryWide,
    icon: styles.skeletonIconBlue,
  },
  {
    label: styles.skeletonLabelMedium,
    value: styles.skeletonValueMedium,
    secondary: styles.skeletonSecondaryMedium,
    icon: styles.skeletonIconGreen,
  },
  {
    label: styles.skeletonLabelShort,
    value: styles.skeletonValueShort,
    secondary: styles.skeletonSecondaryShort,
    icon: styles.skeletonIconAmber,
  },
] as const;

type StatisticsManagerProps = {
  fiscalEnvironment: BillingFiscalEnvironment;
  initialYear: number;
  initialMonth: number;
  invoicedYears?: readonly number[];
  initialSection?: "clients" | "rubros";
  initialAnalysis?: StatisticsNavAnalysis | null;
  initialScrollToSection?: boolean;
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
    secondary: countLabel(row.counts.documentCount, "factura", "facturas"),
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
    secondary: `${countLabel(row.invoiceCount, "factura vinculada", "facturas vinculadas")} · ${formatStatisticsQuantity(row.quantity)} unidades`,
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
    secondary: countLabel(client.counts.documentCount, "factura", "facturas"),
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
    secondary: `${countLabel(rubro.invoiceCount, "factura vinculada", "facturas vinculadas")} · ${formatStatisticsQuantity(rubro.quantity)} unidades`,
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
  invoicedYears,
  initialSection = "clients",
  initialAnalysis = null,
  initialScrollToSection = false,
}: StatisticsManagerProps) {
  useReportAdminSectionReady(true);
  const analysisRequest = useRef(initialAnalysis);
  const sectionRequest = useRef(initialScrollToSection);
  const today = useMemo(
    () => ({ year: initialYear, month: initialMonth }),
    [initialYear, initialMonth],
  );
  const availableYears = statisticsInvoicedYearOptions(invoicedYears ?? [initialYear]);
  const [selection, setSelection] = useState<StatisticsMonthSelection>(() => {
    const year = statisticsSelectableYear(initialYear, invoicedYears ?? [initialYear]);
    const created = createMonthSelection(year, initialMonth);
    return initialAnalysis === "evolucion" ? toggleFullYear(created) : created;
  });
  const [section, setSection] = useState<"clients" | "rubros">(initialSection);
  const [clientKey, setClientKey] = useState<string | null>(null);
  const [rubroKey, setRubroKey] = useState<string | null>(null);
  const [showAllClients, setShowAllClients] = useState(false);
  const [showAllRubros, setShowAllRubros] = useState(false);
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
    if (!view) {
      return;
    }

    const analysis = analysisRequest.current;
    if (analysis) {
      const node = document.getElementById(`statistics-analysis-${analysis}`);
      if (!node) {
        return;
      }

      analysisRequest.current = null;
      sectionRequest.current = false;
      node.scrollIntoView({ block: "start" });
      return;
    }

    if (!sectionRequest.current) {
      return;
    }

    const node = document.getElementById("statistics-entity-section");
    if (!node) {
      return;
    }

    sectionRequest.current = false;
    node.scrollIntoView({ block: "start" });
  }, [view, section]);

  const selectedEntityKey = section === "clients" ? clientKey : rubroKey;

  useEffect(() => {
    if (!selectedEntityKey) {
      return;
    }

    const node = document.getElementById(STATISTICS_SELECTED_ENTITY_ID);
    if (!node) {
      return;
    }

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({
      block: "start",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [section, selectedEntityKey]);

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
          yearOptions={availableYears}
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
        />
      </section>

      <div
        className={`${styles.results}${selection.months.length === 0 ? ` ${styles.resultsEmpty}` : ""}`}
        aria-busy={waitingForYear}
      >
        {selection.months.length === 0 ? (
          <div className={styles.emptyPrompt} role="status">
            <BarChart3 className={styles.emptyPromptIcon} strokeWidth={ICON_STROKE} aria-hidden />
            <p className={styles.emptyPromptText}>
              Seleccioná uno o más meses para consultar sus estadísticas.
            </p>
          </div>
        ) : null}

        {selection.months.length > 0 && waitingForYear ? (
          <>
            <section className={styles.section} aria-hidden>
              <div className={styles.kpiGrid}>
                {STATISTICS_SKELETON_KPIS.map((card) => (
                  <article key={card.icon} className={styles.skeletonCard}>
                    <div className={styles.skeletonTop}>
                      <span className={`${styles.skeletonBar} ${card.label}`} />
                      <span className={`${styles.skeletonIcon} ${card.icon}`} />
                    </div>
                    <span className={`${styles.skeletonBar} ${card.value}`} />
                    <span className={`${styles.skeletonBar} ${card.secondary}`} />
                  </article>
                ))}
              </div>
              <ul className={styles.counts}>
                {[0, 1].map((item) => (
                  <li key={item}>
                    <span className={`${styles.skeletonBar} ${styles.skeletonCountLabel}`} />
                    <span className={`${styles.skeletonBar} ${styles.skeletonCountValue}`} />
                  </li>
                ))}
              </ul>
            </section>
            <section className={styles.panel} aria-hidden>
              <div className={styles.skeletonTitleRow}>
                <span className={styles.skeletonTitleIcon} />
                <span className={`${styles.skeletonBar} ${styles.skeletonPanelTitle}`} />
              </div>
              <div className={styles.skeletonLines}>
                <span className={`${styles.skeletonBar} ${styles.skeletonLineWide}`} />
                <span className={`${styles.skeletonBar} ${styles.skeletonLineMedium}`} />
                <span className={`${styles.skeletonBar} ${styles.skeletonLineShort}`} />
              </div>
            </section>
            <section className={styles.section} aria-hidden>
              <div className={styles.sectionSwitch}>
                <span className={`${styles.sectionTab} ${styles.sectionTabActive}`}>
                  <span className={`${styles.skeletonBar} ${styles.skeletonTabLabel}`} />
                </span>
                <span className={styles.sectionTab}>
                  <span className={`${styles.skeletonBar} ${styles.skeletonTabLabelMuted}`} />
                </span>
              </div>
              <div className={styles.chartSplit}>
                <section className={styles.panel}>
                  <span className={`${styles.skeletonBar} ${styles.skeletonPanelTitle}`} />
                  <div className={styles.rankList}>
                    {STATISTICS_SKELETON_RANKS.map((nameWidth, index) => (
                      <div key={nameWidth + STATISTICS_SKELETON_BARS[index]} className={styles.skeletonRank}>
                        <div className={styles.skeletonRankHead}>
                          <span className={`${styles.skeletonBar} ${nameWidth}`} />
                          <span className={`${styles.skeletonBar} ${styles.skeletonRankAmount}`} />
                        </div>
                        <span className={`${styles.skeletonBar} ${styles.skeletonRankMeta}`} />
                        <span className={styles.skeletonRankTrack}>
                          <span
                            className={styles.skeletonRankFill}
                            style={{ width: STATISTICS_SKELETON_BARS[index] }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className={styles.panel}>
                  <span className={`${styles.skeletonBar} ${styles.skeletonPanelTitle}`} />
                  <div className={styles.skeletonDonutWrap}>
                    <span className={styles.skeletonDonut} />
                  </div>
                  <ul className={styles.legend}>
                    {STATISTICS_SKELETON_RANKS.map((nameWidth, index) => (
                      <li key={`${nameWidth}-${index}`}>
                        <span className={styles.skeletonSwatch} />
                        <span className={`${styles.skeletonBar} ${styles.skeletonLegendName}`} />
                        <span className={`${styles.skeletonBar} ${styles.skeletonLegendAmount}`} />
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </section>
          </>
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
            <StatisticsConclusions
              conclusions={view.conclusions}
              names={[
                ...view.selectedMonths.map((month) => month.name),
                ...view.clients.map((client) => client.name),
                ...view.rubros.map((rubro) => rubro.name),
              ]}
            />
            {isFullYearSelection(selection.months) ? (
              <StatisticsEvolution
                monthly={view.chartMonths}
                selectedMonths={selection.months}
                caption={caption}
                onToggleMonth={toggleMonth}
              />
            ) : null}
            {selection.months.length > 1 ? <StatisticsMonthComparison view={view} /> : null}
            <section
              id="statistics-entity-section"
              className={styles.section}
              aria-label="Detalle por clientes y rubros"
            >
              <div className={styles.sectionSwitch} role="tablist" aria-label="Estadísticas por">
                <button
                  type="button"
                  role="tab"
                  aria-selected={section === "clients"}
                  className={`${styles.sectionTab} ${section === "clients" ? styles.sectionTabActive : ""}`}
                  onClick={() => setSection("clients")}
                >
                  <BookUser className={styles.sectionTabIcon} strokeWidth={ICON_STROKE} aria-hidden />
                  Estadísticas de Clientes
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={section === "rubros"}
                  className={`${styles.sectionTab} ${section === "rubros" ? styles.sectionTabActive : ""}`}
                  onClick={() => setSection("rubros")}
                >
                  <Tags className={styles.sectionTabIcon} strokeWidth={ICON_STROKE} aria-hidden />
                  Estadísticas de Rubros
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
                    />
                  )}
                />
              )}
            </section>
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
