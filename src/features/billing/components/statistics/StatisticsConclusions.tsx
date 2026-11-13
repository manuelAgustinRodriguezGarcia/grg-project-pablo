"use client";

import type { ReactNode } from "react";
import { ICON_STROKE, NotebookPen } from "@/shared/icons";
import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsConclusionsProps = {
  conclusions: readonly string[];
  names: readonly string[];
};

const PERCENT = /-?\d+,\d{2} %/g;
const AMOUNT = /-?\$[\s\u00a0\u202f]*\d{1,3}(?:\.\d{3})*,\d{2}/g;

type TextSpan = {
  start: number;
  end: number;
};

function isNameBoundary(char: string | undefined): boolean {
  if (!char) {
    return true;
  }
  return !/[\p{L}\p{N}]/u.test(char);
}

function markSpan(used: boolean[], span: TextSpan): void {
  for (let index = span.start; index < span.end; index += 1) {
    used[index] = true;
  }
}

function overlaps(used: readonly boolean[], span: TextSpan): boolean {
  for (let index = span.start; index < span.end; index += 1) {
    if (used[index]) {
      return true;
    }
  }
  return false;
}

function collectEmphasis(text: string, names: readonly string[]): TextSpan[] {
  const used = Array.from({ length: text.length }, () => false);
  const spans: TextSpan[] = [];
  const uniqueNames = [...new Set(names.filter((name) => name.length > 0))]
    .sort((left, right) => right.length - left.length);

  for (const name of uniqueNames) {
    let from = 0;
    while (from < text.length) {
      const start = text.indexOf(name, from);
      if (start < 0) {
        break;
      }
      const span = { start, end: start + name.length };
      if (
        isNameBoundary(text[start - 1])
        && isNameBoundary(text[span.end])
        && !overlaps(used, span)
      ) {
        spans.push(span);
        markSpan(used, span);
      }
      from = start + name.length;
    }
  }

  for (const pattern of [PERCENT, AMOUNT]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      if (start === undefined) {
        continue;
      }
      const span = { start, end: start + match[0].length };
      if (!overlaps(used, span)) {
        spans.push(span);
        markSpan(used, span);
      }
    }
  }

  spans.sort((left, right) => left.start - right.start);
  return spans;
}

function emphasizeConclusion(text: string, names: readonly string[]): ReactNode[] {
  const spans = collectEmphasis(text, names);
  if (spans.length === 0) {
    return [text];
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, index) => {
    if (span.start > cursor) {
      nodes.push(text.slice(cursor, span.start));
    }
    nodes.push(<strong key={`${span.start}-${index}`}>{text.slice(span.start, span.end)}</strong>);
    cursor = span.end;
  });
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

export function StatisticsConclusions({ conclusions, names }: StatisticsConclusionsProps) {
  if (conclusions.length === 0) {
    return null;
  }

  return (
    <section className={styles.panel} aria-label="Conclusiones del período">
      <h2 className={`${styles.sectionTitle} ${styles.sectionTitleWithIcon}`}>
        <NotebookPen className={styles.sectionTitleIcon} strokeWidth={ICON_STROKE} aria-hidden />
        Conclusiones del período
      </h2>
      <ul className={styles.shiftList}>
        {conclusions.map((conclusion) => (
          <li key={conclusion}>{emphasizeConclusion(conclusion, names)}</li>
        ))}
      </ul>
    </section>
  );
}
