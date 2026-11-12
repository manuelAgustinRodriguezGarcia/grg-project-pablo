import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  StatisticsAdjustmentsView,
  StatisticsCountsView,
  StatisticsMoneyView,
  StatisticsReconciliationView,
} from "@/features/billing/types/billing-statistics.types";
import { formatStatisticsAmount } from "@/features/billing/utils/billing-statistics-display";
import { StatisticsAdjustments } from "./StatisticsAdjustments";

vi.mock("@/features/billing/styles/Statistics.module.scss", () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

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

function money(total: string): StatisticsMoneyView {
  return { net: total, vat: "0.00", total, roundingGap: "0.00" };
}

function counts(creditNoteCount: number, debitNoteCount: number): StatisticsCountsView {
  return {
    invoiceCount: 0,
    creditNoteCount,
    debitNoteCount,
    documentCount: creditNoteCount + debitNoteCount,
  };
}

function reconciliation(input?: {
  adjustments?: string;
  clientsMatch?: boolean;
  clientsDifference?: string;
  distributionMatch?: boolean;
}): StatisticsReconciliationView {
  return {
    general: money("100.00"),
    invoices: money("110.00"),
    notes: money(input?.adjustments ?? "-10.00"),
    clients: money("100.00"),
    rubros: money("90.00"),
    unassigned: money("20.00"),
    adjustments: money(input?.adjustments ?? "-10.00"),
    clientsMinusGeneral: money(input?.clientsDifference ?? "0.00"),
    distributionMinusGeneral: money("0.00"),
    clientsMatchGeneral: input?.clientsMatch !== false,
    distributionMatchGeneral: input?.distributionMatch !== false,
  };
}

function adjustments(creditNoteCount: number, debitNoteCount: number, total = "-10.00"): StatisticsAdjustmentsView {
  return {
    key: "adjustments",
    label: "Ajustes sin rubro",
    totals: money(total),
    counts: counts(creditNoteCount, debitNoteCount),
    sharePercent: null,
    shareUnavailableReason: "NEGATIVE_TOTAL",
  };
}

function renderPanel(
  creditNoteCount: number,
  debitNoteCount: number,
  options?: {
    adjustmentsTotal?: string;
    clientsMatch?: boolean;
    clientsDifference?: string;
  },
) {
  const signedTotal = options?.adjustmentsTotal ?? "-10.00";
  render(
    <StatisticsAdjustments
      counts={counts(0, 0)}
      unassigned={null}
      adjustments={adjustments(creditNoteCount, debitNoteCount, signedTotal)}
      reconciliation={reconciliation({
        adjustments: signedTotal,
        clientsMatch: options?.clientsMatch,
        clientsDifference: options?.clientsDifference,
      })}
    />,
  );
}

describe("ajustes y conciliación", () => {
  it("cuenta las notas de crédito y de débito que componen los ajustes", () => {
    renderPanel(1, 1);

    expect(screen.getByText("1 nota de crédito y 1 nota de débito componen los ajustes.")).toBeInTheDocument();
    expect(screen.getByText(exactText(formatStatisticsAmount("-10.00")))).toBeInTheDocument();
    expect(screen.queryByText(exactText(formatStatisticsAmount("10.00")))).not.toBeInTheDocument();
  });

  it("cuenta una nota de crédito sola", () => {
    renderPanel(2, 0);

    expect(screen.getByText("2 notas de crédito componen los ajustes.")).toBeInTheDocument();
    expect(screen.queryByText(/débito componen los ajustes/)).not.toBeInTheDocument();
  });

  it("cuenta una nota de débito sola", () => {
    renderPanel(0, 1);

    expect(screen.getByText("1 nota de débito compone los ajustes.")).toBeInTheDocument();
    expect(screen.queryByText(/crédito componen los ajustes/)).not.toBeInTheDocument();
  });

  it("no informa notas cuando el período no tiene ajustes", () => {
    renderPanel(0, 0, { adjustmentsTotal: "0.00" });

    expect(screen.queryByText(/componen los ajustes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/compone los ajustes/)).not.toBeInTheDocument();
    expect(screen.getAllByText(exactText(formatStatisticsAmount("0.00"))).length).toBeGreaterThan(0);
  });

  it("confirma la conciliación de clientes cuando coincide", () => {
    renderPanel(1, 0, { clientsMatch: true });

    expect(screen.getByText("Los importes por cliente coinciden con el total general.")).toBeInTheDocument();
    expect(
      screen.getByText("Rubros comerciales, montos sin asignar y ajustes coinciden con el total general."),
    ).toBeInTheDocument();
  });

  it("muestra la diferencia monetaria de clientes que ya calculó el servidor", () => {
    renderPanel(1, 1, { clientsMatch: false, clientsDifference: "-15.50" });

    expect(
      screen.getByText(
        exactText(
          `Los importes por cliente difieren del total general en ${formatStatisticsAmount("-15.50")}.`,
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(exactText(formatStatisticsAmount("-10.00")))).toBeInTheDocument();
    expect(screen.queryByText(exactText(formatStatisticsAmount("15.50")))).not.toBeInTheDocument();
  });
});
