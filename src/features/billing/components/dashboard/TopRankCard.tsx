"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { DashboardTopItem } from "@/features/billing/data/dashboardTypes";
import { getBlueScaleColor, getGreenScaleColor } from "@/features/billing/utils/dashboard-chart-colors";
import { formatArs } from "@/features/billing/utils/format-ars";
import { ChevronDown, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/billing/styles/Dashboard.module.scss";

type RankBy = "amount" | "invoiceCount";

type TopRankCardProps = {
  title: string;
  items: readonly DashboardTopItem[];
  icon: LucideIcon;
  barTone?: "blue" | "green";
  rankBy?: RankBy;
  footerHref?: string;
  footerLabel?: string;
  showRankIndex?: boolean;
  scrollableList?: boolean;
  className?: string;
  emptyLabel?: string;
};

function getRankValue(item: DashboardTopItem, rankBy: RankBy): number {
  switch (rankBy) {
    case "amount":
      return item.amount;
    case "invoiceCount":
      return item.invoiceCount ?? item.amount;
    default: {
      const _exhaustive: never = rankBy;
      return _exhaustive;
    }
  }
}

function invoiceCountLabel(count: number): string {
  return `${count} ${count === 1 ? "factura" : "facturas"}`;
}

export function TopRankCard({
  title,
  items,
  icon: Icon,
  barTone = "blue",
  rankBy = "amount",
  footerHref,
  footerLabel,
  showRankIndex = true,
  scrollableList = false,
  className,
  emptyLabel = "Todavía no hay datos para mostrar.",
}: TopRankCardProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const rankedItems = [...items].sort(
    (left, right) => getRankValue(right, rankBy) - getRankValue(left, rankBy),
  );
  const maxBarValue = Math.max(
    ...rankedItems.map((item) => getRankValue(item, rankBy)),
    1,
  );
  const isGreen = barTone === "green";
  const getBarColor = isGreen ? getGreenScaleColor : getBlueScaleColor;
  const showFooter = Boolean(footerHref && footerLabel);

  const updateScrollHint = useCallback(() => {
    if (!scrollableList) {
      setShowScrollHint(false);
      return;
    }

    const list = listRef.current;
    if (!list) {
      setShowScrollHint(false);
      return;
    }

    const hasOverflow = list.scrollHeight > list.clientHeight + 1;
    const atBottom =
      list.scrollTop + list.clientHeight >= list.scrollHeight - 4;
    setShowScrollHint(hasOverflow && !atBottom);
  }, [scrollableList]);

  useEffect(() => {
    updateScrollHint();

    const list = listRef.current;
    if (!list || !scrollableList) {
      return;
    }

    list.addEventListener("scroll", updateScrollHint, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollHint);
    resizeObserver.observe(list);

    return () => {
      list.removeEventListener("scroll", updateScrollHint);
      resizeObserver.disconnect();
    };
  }, [rankedItems.length, scrollableList, updateScrollHint]);

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()}>
      <div className={styles.cardHeading}>
        <span
          className={`${styles.cardIcon} ${isGreen ? styles.cardIconGreen : styles.cardIconBlue}`}
          aria-hidden
        >
          <Icon strokeWidth={ICON_STROKE} />
        </span>
        <h2 className={styles.cardTitle}>{title}</h2>
      </div>
      <div className={scrollableList ? styles.rankListWrap : undefined}>
        {rankedItems.length === 0 ? (
          <p className={styles.emptyHint} role="status">
            {emptyLabel}
          </p>
        ) : (
          <ol
            ref={listRef}
            className={`${styles.rankList} ${scrollableList ? styles.rankListScrollable : ""}`.trim()}
          >
          {rankedItems.map((item, index) => {
            const barValue = getRankValue(item, rankBy);
            const width = `${Math.max(8, (barValue / maxBarValue) * 100)}%`;
            const barColor = getBarColor(index, rankedItems.length);
            const showInvoiceCount = item.invoiceCount != null;
            const invoicesPrimary =
              rankBy === "invoiceCount" && showInvoiceCount;
            return (
              <li
                key={item.name}
                className={`${styles.rankItem} ${showRankIndex ? "" : styles.rankItemPlain}`.trim()}
              >
                {showRankIndex ? (
                  <span className={styles.rankIndex}>{index + 1}</span>
                ) : null}
                <span className={styles.rankName} title={item.name}>
                  {item.name}
                </span>
                <strong
                  className={`${styles.rankAmount} ${
                    showInvoiceCount ? styles.rankAmountStacked : ""
                  }`.trim()}
                >
                  {invoicesPrimary ? (
                    <>
                      <span className={styles.rankInvoiceCount}>
                        {invoiceCountLabel(item.invoiceCount ?? 0)}
                      </span>
                      <span className={styles.rankAmountMuted}>
                        {formatArs(item.amount)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>{formatArs(item.amount)}</span>
                      {showInvoiceCount ? (
                        <span className={styles.rankAmountMuted}>
                          {invoiceCountLabel(item.invoiceCount ?? 0)}
                        </span>
                      ) : null}
                    </>
                  )}
                </strong>
                <div className={styles.rankBarTrack} aria-hidden>
                  <div
                    className={styles.rankBarFill}
                    style={{ width, background: barColor }}
                  />
                </div>
              </li>
            );
          })}
          </ol>
        )}
        {showScrollHint ? (
          <div className={styles.rankScrollHint} aria-hidden>
            <ChevronDown
              className={styles.rankScrollHintIcon}
              strokeWidth={ICON_STROKE}
            />
          </div>
        ) : null}
      </div>
      {showFooter ? (
        <Link
          href={footerHref!}
          className={`${styles.cardFooterLink} ${isGreen ? styles.cardFooterLinkGreen : ""}`}
        >
          {footerLabel}
        </Link>
      ) : null}
    </section>
  );
}
