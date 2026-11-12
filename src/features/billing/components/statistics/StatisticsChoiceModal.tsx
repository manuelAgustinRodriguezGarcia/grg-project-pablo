"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useEscapeToClose } from "@/features/billing/hooks/useBillingModalKeyboard";
import {
  billingStatisticsHref,
  type StatisticsNavAnalysis,
  type StatisticsNavSection,
} from "@/features/billing/utils/billing-statistics-navigation";
import { ICON_STROKE, X } from "@/shared/icons";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";
import styles from "@/features/billing/styles/StatisticsChoiceModal.module.scss";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

const DESCRIPTION = "Seleccioná el análisis que querés consultar.";

type StatisticsChoice = {
  analysis: StatisticsNavAnalysis;
  label: string;
};

const CLIENT_OPTIONS: readonly StatisticsChoice[] = [
  { analysis: "ranking", label: "Ranking por facturación" },
  { analysis: "participacion", label: "Participación en la facturación" },
  { analysis: "evolucion", label: "Evolución mensual" },
];

const RUBRO_OPTIONS: readonly StatisticsChoice[] = [
  { analysis: "ranking", label: "Ranking por facturación" },
  { analysis: "participacion", label: "Distribución de facturación" },
  { analysis: "evolucion", label: "Evolución mensual" },
];

type StatisticsChoiceModalProps = {
  section: StatisticsNavSection;
  onClose: () => void;
};

function sectionTitle(section: StatisticsNavSection): string {
  switch (section) {
    case "clientes":
      return "Estadísticas de clientes";
    case "rubros":
      return "Estadísticas de rubros";
    default: {
      const unexpected: never = section;
      return unexpected;
    }
  }
}

function sectionOptions(
  section: StatisticsNavSection,
): readonly StatisticsChoice[] {
  switch (section) {
    case "clientes":
      return CLIENT_OPTIONS;
    case "rubros":
      return RUBRO_OPTIONS;
    default: {
      const unexpected: never = section;
      return unexpected;
    }
  }
}

export function StatisticsChoiceModal({
  section,
  onClose,
}: StatisticsChoiceModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const title = sectionTitle(section);
  const options = sectionOptions(section);
  const titleId = "statistics-choice-title";
  const descriptionId = "statistics-choice-description";

  useEffect(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    headingRef.current?.focus();

    function handleTab(event: KeyboardEvent) {
      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ];
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const index =
        active instanceof HTMLElement ? focusable.indexOf(active) : -1;

      if (index === -1 || !(active instanceof HTMLElement) || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => {
      document.removeEventListener("keydown", handleTab);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, []);

  useEscapeToClose(onClose);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={modalStyles.modalOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={modalStyles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className={modalStyles.modalHeader}>
          <div className={modalStyles.modalHeaderText}>
            <h2
              id={titleId}
              ref={headingRef}
              className={modalStyles.modalTitle}
              tabIndex={-1}
            >
              {title}
            </h2>
            <p id={descriptionId} className={modalStyles.modalSubtitle}>
              {DESCRIPTION}
            </p>
          </div>
          <button
            type="button"
            className={modalStyles.modalCloseButton}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>
        <ul className={styles.options}>
          {options.map((option) => (
            <li key={option.analysis}>
              <Link
                href={billingStatisticsHref(section, option.analysis)}
                className={styles.option}
              >
                {option.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
