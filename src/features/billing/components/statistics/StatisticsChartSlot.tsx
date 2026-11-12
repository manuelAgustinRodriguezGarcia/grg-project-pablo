"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { StatisticsChartPoint } from "@/features/billing/utils/billing-statistics-display";
import styles from "@/features/billing/styles/Statistics.module.scss";

type ChartBlockProps = {
  kind: "evolution" | "pie";
  points: StatisticsChartPoint[];
  onToggleMonth?: (month: number) => void;
};

export function StatisticsChartSlot({
  height,
  ...props
}: ChartBlockProps & { height: number }) {
  const [Chart, setChart] = useState<ComponentType<ChartBlockProps> | null>(null);

  useEffect(() => {
    let active = true;
    void import("./StatisticsCharts").then((module) => {
      if (active) {
        setChart(() => module.StatisticsChartBlock);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={styles.chartFrame} style={{ height }} aria-hidden={Chart ? undefined : true}>
      {Chart ? <Chart {...props} /> : null}
    </div>
  );
}
