"use client";

import type { ReactNode } from "react";
import { formatArs } from "@/features/billing/utils/format-ars";
import styles from "@/features/billing/styles/Dashboard.module.scss";

type TooltipPayloadItem = {
  value?: number | string;
  name?: string | number;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  valueFormatter?: (value: number) => string;
};

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = formatArs,
}: ChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const raw = payload[0]?.value;
  const value = typeof raw === "number" ? raw : Number(raw);

  return (
    <div className={styles.tooltip}>
      {label != null && label !== "" ? (
        <p className={styles.tooltipLabel}>{String(label)}</p>
      ) : null}
      <p className={styles.tooltipValue}>
        {Number.isFinite(value) ? valueFormatter(value) : "—"}
      </p>
    </div>
  );
}

export function DonutTooltip({
  active,
  payload,
  valueFormatter = formatArs,
}: ChartTooltipProps): ReactNode {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];
  const amount =
    typeof item?.value === "number" ? item.value : Number(item?.value);
  const name = String(item?.name ?? "");

  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{name}</p>
      <p className={styles.tooltipValue}>
        {Number.isFinite(amount) ? valueFormatter(amount) : "—"}
      </p>
    </div>
  );
}
