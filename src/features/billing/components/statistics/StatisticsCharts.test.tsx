import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DASHBOARD_BLUE_SCALE,
  DASHBOARD_GREEN_SCALE,
} from "@/features/billing/utils/dashboard-chart-colors";
import {
  formatStatisticsAmount,
  type StatisticsChartPoint,
} from "@/features/billing/utils/billing-statistics-display";
import { StatisticsChartBlock, StatisticsTooltip } from "./StatisticsCharts";

vi.mock("@/features/billing/styles/Dashboard.module.scss", () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: ({ domain }: { domain?: unknown }) => (
    <span data-testid="y-axis" data-has-domain={domain ? "yes" : "no"} />
  ),
  Tooltip: () => null,
  Bar: ({ children, dataKey }: { children?: ReactNode; dataKey: string }) => (
    <div data-testid={`bar-${dataKey}`}>{children}</div>
  ),
  Cell: ({ fill }: { fill: string }) => <span data-testid="cell" data-fill={fill} />,
  ReferenceLine: ({ y }: { y: number }) => <span data-testid="zero-line" data-y={String(y)} />,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pie: () => null,
}));

const NEUTRAL = "rgba(3, 27, 61, 0.28)";
const NEGATIVE = "#dc2626";

function point(
  overrides: Partial<StatisticsChartPoint> & Pick<StatisticsChartPoint, "key" | "total" | "amount">,
): StatisticsChartPoint {
  return {
    label: overrides.key,
    comparisonTotal: null,
    comparisonAmount: null,
    active: false,
    ...overrides,
  };
}

function fills(bar: HTMLElement): string[] {
  return within(bar).getAllByTestId("cell").map((cell) => cell.getAttribute("data-fill") ?? "");
}

function exactText(expected: string) {
  const normalized = expected.replace(/\u00a0/g, " ");
  return (_content: string, element: Element | null) =>
    element != null &&
    element.children.length === 0 &&
    (element.textContent ?? "").replace(/\u00a0/g, " ") === normalized;
}

afterEach(() => {
  cleanup();
});

describe("evolución mensual", () => {
  it("distingue meses positivos, negativos y en cero sin invertir el signo", () => {
    render(
      <StatisticsChartBlock
        kind="evolution"
        points={[
          point({ key: "oct", label: "Oct", total: "10.00", amount: 10, active: true, comparisonTotal: "5.00", comparisonAmount: 5 }),
          point({ key: "nov", label: "Nov", total: "-121.50", amount: -121.5, comparisonTotal: "-2.00", comparisonAmount: -2 }),
          point({ key: "dic", label: "Dic", total: "0.00", amount: 0, comparisonTotal: "0.00", comparisonAmount: 0 }),
        ]}
      />,
    );

    expect(fills(screen.getByTestId("bar-amount"))).toEqual([
      DASHBOARD_BLUE_SCALE[0],
      NEGATIVE,
      NEUTRAL,
    ]);
    expect(fills(screen.getByTestId("bar-comparisonAmount"))).toEqual([
      DASHBOARD_GREEN_SCALE[2],
      NEGATIVE,
      NEUTRAL,
    ]);
    expect(screen.getByTestId("zero-line")).toHaveAttribute("data-y", "0");
    expect(screen.getByTestId("y-axis")).toHaveAttribute("data-has-domain", "yes");
    expect(screen.getByTestId("bar-amount")).not.toHaveTextContent("121.5");
  });

  it("conserva la escala automática cuando no hay importes negativos", () => {
    render(
      <StatisticsChartBlock
        kind="evolution"
        points={[
          point({ key: "oct", total: "10.00", amount: 10, active: true }),
          point({ key: "nov", total: "0.00", amount: 0 }),
        ]}
      />,
    );

    expect(fills(screen.getByTestId("bar-amount"))).toEqual([
      DASHBOARD_BLUE_SCALE[0],
      NEUTRAL,
    ]);
    expect(screen.queryByTestId("zero-line")).not.toBeInTheDocument();
    expect(screen.getByTestId("y-axis")).toHaveAttribute("data-has-domain", "no");
    expect(screen.queryByTestId("bar-comparisonAmount")).not.toBeInTheDocument();
  });

  it("muestra en el tooltip el importe negativo completo", () => {
    const negative = point({
      key: "nov",
      label: "Noviembre",
      total: "-121.50",
      amount: -121.5,
      comparisonTotal: "-40.00",
      comparisonAmount: -40,
    });

    render(
      <StatisticsTooltip
        active
        label="Noviembre"
        payload={[
          { dataKey: "amount", payload: negative },
          { dataKey: "comparisonAmount", payload: negative },
        ]}
      />,
    );

    expect(screen.getByText(exactText(formatStatisticsAmount("-121.50")))).toBeInTheDocument();
    expect(
      screen.getByText(exactText(`Comparado: ${formatStatisticsAmount("-40.00")}`)),
    ).toBeInTheDocument();
    expect(screen.queryByText(exactText(formatStatisticsAmount("121.50")))).not.toBeInTheDocument();
    expect(screen.queryByText(exactText(formatStatisticsAmount("40.00")))).not.toBeInTheDocument();
  });

  it("no agrega la línea de cero al gráfico de torta", () => {
    render(
      <StatisticsChartBlock
        kind="pie"
        points={[point({ key: "frenos", total: "10.00", amount: 10 })]}
      />,
    );

    expect(screen.queryByTestId("zero-line")).not.toBeInTheDocument();
  });
});
