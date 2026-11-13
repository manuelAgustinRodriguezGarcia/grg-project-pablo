import { BILLING_STATISTICS_PATH } from "@/features/billing/utils/billing-statistics-period";

export const STATISTICS_SECTION_QUERY = "seccion";
export const STATISTICS_ANALYSIS_QUERY = "analisis";

export type StatisticsNavSection = "clientes" | "rubros";
export type StatisticsNavAnalysis = "ranking" | "participacion" | "evolucion";
export type StatisticsViewSection = "clients" | "rubros";

export type StatisticsNavigationTarget = {
  section: StatisticsViewSection;
  analysis: StatisticsNavAnalysis | null;
  scrollToSection: boolean;
};

const DEFAULT_TARGET: StatisticsNavigationTarget = {
  section: "clients",
  analysis: null,
  scrollToSection: false,
};

const SECTIONS: readonly StatisticsNavSection[] = ["clientes", "rubros"];
const ANALYSES: readonly StatisticsNavAnalysis[] = [
  "ranking",
  "participacion",
  "evolucion",
];

function cleanParam(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isSection(value: string): value is StatisticsNavSection {
  return (SECTIONS as readonly string[]).includes(value);
}

function isAnalysis(value: string): value is StatisticsNavAnalysis {
  return (ANALYSES as readonly string[]).includes(value);
}

function viewSection(section: StatisticsNavSection): StatisticsViewSection {
  switch (section) {
    case "clientes":
      return "clients";
    case "rubros":
      return "rubros";
    default: {
      const unexpected: never = section;
      return unexpected;
    }
  }
}

export function parseStatisticsNavigation(
  sectionParam: string | undefined,
  analysisParam: string | undefined,
): StatisticsNavigationTarget {
  const sectionValue = cleanParam(sectionParam);
  const analysisValue = cleanParam(analysisParam);

  if (
    (sectionValue !== undefined && !isSection(sectionValue)) ||
    (analysisValue !== undefined && !isAnalysis(analysisValue))
  ) {
    return DEFAULT_TARGET;
  }

  const analysis = analysisValue ?? null;

  return {
    section: sectionValue ? viewSection(sectionValue) : DEFAULT_TARGET.section,
    analysis,
    scrollToSection: sectionValue !== undefined && analysis === null,
  };
}

export function billingStatisticsSectionHref(section: StatisticsNavSection): string {
  const params = new URLSearchParams({
    [STATISTICS_SECTION_QUERY]: section,
  });
  return `${BILLING_STATISTICS_PATH}?${params.toString()}`;
}

export function billingStatisticsHref(
  section: StatisticsNavSection,
  analysis: StatisticsNavAnalysis,
): string {
  const params = new URLSearchParams({
    [STATISTICS_SECTION_QUERY]: section,
    [STATISTICS_ANALYSIS_QUERY]: analysis,
  });
  return `${BILLING_STATISTICS_PATH}?${params.toString()}`;
}
