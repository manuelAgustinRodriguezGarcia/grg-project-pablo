"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DASHBOARD_BLUE_SCALE,
  DASHBOARD_GREEN_SCALE,
  getBlueScaleColorsByAmount,
} from "@/features/billing/utils/dashboard-chart-colors";
import {
  formatStatisticsAmount,
  type StatisticsChartPoint,
} from "@/features/billing/utils/billing-statistics-display";
import { formatCompactArs } from "@/features/billing/utils/format-ars";
import dashboardStyles from "@/features/billing/styles/Dashboard.module.scss";

const AXIS_TICK = { fill: "rgba(3, 27, 61, 0.62)", fontSize: 12 };
const NEGATIVE = "#dc2626";
const MUTED_NEGATIVE = "rgba(220, 38, 38, 0.4)";
const EVOLUTION_NEUTRAL = "rgba(3, 27, 61, 0.28)";
const ZERO_LINE = "rgba(3, 27, 61, 0.45)";

type ChartBlockProps = {
  kind: "evolution" | "pie";
  points: StatisticsChartPoint[];
  onToggleMonth?: (month: number) => void;
};

function compactAxis(value: number | string): string {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? formatCompactArs(amount) : "";
}

function evolutionBarFill(
  amount: number | null,
  active: boolean,
  compared: boolean,
  muted: boolean,
): string {
  if (amount == null) {
    return "transparent";
  }
  if (amount < 0) {
    return muted ? MUTED_NEGATIVE : NEGATIVE;
  }
  if (amount === 0) {
    return EVOLUTION_NEUTRAL;
  }
  if (compared) {
    return DASHBOARD_GREEN_SCALE[2];
  }
  if (muted) {
    return DASHBOARD_BLUE_SCALE[4];
  }
  return active ? DASHBOARD_BLUE_SCALE[0] : DASHBOARD_BLUE_SCALE[3];
}

function evolutionHasNegative(points: readonly StatisticsChartPoint[]): boolean {
  return points.some(
    (point) =>
      point.amount < 0 ||
      (point.comparisonAmount != null && point.comparisonAmount < 0),
  );
}

export function StatisticsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    payload?: StatisticsChartPoint;
  }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  const title = point?.label || (label != null ? String(label) : "");

  return (
    <div className={dashboardStyles.tooltip}>
      {title ? <p className={dashboardStyles.tooltipLabel}>{title}</p> : null}
      {payload.map((item) => {
        const source = item.payload;
        if (!source) {
          return null;
        }
        const compared = item.dataKey === "comparisonAmount";
        const total = compared ? source.comparisonTotal : source.total;
        if (total == null || total === "") {
          return null;
        }
        return (
          <p key={String(item.dataKey)} className={dashboardStyles.tooltipValue}>
            {compared ? "Comparado: " : null}
            {formatStatisticsAmount(total)}
          </p>
        );
      })}
    </div>
  );
}

function EvolutionChart({
  points,
  onToggleMonth,
}: {
  points: StatisticsChartPoint[];
  onToggleMonth?: (month: number) => void;
}) {
  const compared = points.some((point) => point.comparisonAmount !== null);
  const hasNegative = evolutionHasNegative(points);
  const axisKey = points.some((point) => point.axisLabel) ? "axisLabel" : "label";

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={150}>
      <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(3, 27, 61, 0.08)" vertical={false} />
        <XAxis dataKey={axisKey} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={compactAxis}
          width={64}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          domain={
            hasNegative
              ? [(dataMin: number) => Math.min(0, dataMin), (dataMax: number) => Math.max(0, dataMax)]
              : undefined
          }
        />
        {hasNegative ? <ReferenceLine y={0} stroke={ZERO_LINE} /> : null}
        <Tooltip content={<StatisticsTooltip />} wrapperStyle={{ zIndex: 5 }} />
        <Bar
          dataKey="amount"
          radius={[8, 8, 0, 0]}
          maxBarSize={28}
          cursor={onToggleMonth ? "pointer" : undefined}
          onClick={(row: StatisticsChartPoint) => {
            if (onToggleMonth && row.month) {
              onToggleMonth(row.month);
            }
          }}
        >
          {points.map((point) => (
            <Cell
              key={point.key}
              fill={evolutionBarFill(point.amount, point.active, false, Boolean(point.muted))}
            />
          ))}
        </Bar>
        {compared ? (
          <Bar dataKey="comparisonAmount" radius={[8, 8, 0, 0]} maxBarSize={28}>
            {points.map((point) => (
              <Cell
                key={`${point.key}-comparison`}
                fill={evolutionBarFill(point.comparisonAmount, point.active, true, Boolean(point.muted))}
              />
            ))}
          </Bar>
        ) : null}
      </BarChart>
    </ResponsiveContainer>
  );
}

function ParticipationPie({ points }: { points: StatisticsChartPoint[] }) {
  const colors = getBlueScaleColorsByAmount(points);

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={150}>
      <PieChart>
        <Pie
          data={points}
          dataKey="amount"
          nameKey="label"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="none"
        >
          {points.map((point, index) => (
            <Cell key={point.key} fill={colors[index] ?? DASHBOARD_BLUE_SCALE[3]} />
          ))}
        </Pie>
        <Tooltip content={<StatisticsTooltip />} wrapperStyle={{ zIndex: 5 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function StatisticsChartBlock({ kind, points, onToggleMonth }: ChartBlockProps) {
  switch (kind) {
    case "evolution":
      return <EvolutionChart points={points} onToggleMonth={onToggleMonth} />;
    case "pie":
      return <ParticipationPie points={points} />;
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}
