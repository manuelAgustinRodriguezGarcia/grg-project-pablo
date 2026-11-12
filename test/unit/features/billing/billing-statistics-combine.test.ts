import { describe, expect, it } from "vitest";
import type {
  StatisticsMoneyView,
  StatisticsYearMonth,
  StatisticsYearResponse,
} from "@/features/billing/types/billing-statistics.types";
import { combineStatisticsYear } from "@/features/billing/utils/billing-statistics-combine";

function money(total: string, net = total, vat = "0.00"): StatisticsMoneyView {
  return { net, vat, total, roundingGap: "0.00" };
}

function emptyCounts() {
  return { invoiceCount: 0, creditNoteCount: 0, debitNoteCount: 0, documentCount: 0 };
}

function month(input: Partial<StatisticsYearMonth> & Pick<StatisticsYearMonth, "month">): StatisticsYearMonth {
  return {
    year: 2026,
    totals: money("0.00"),
    counts: emptyCounts(),
    invoices: money("0.00"),
    notes: money("0.00"),
    creditNotes: money("0.00"),
    debitNotes: money("0.00"),
    clients: [],
    rubros: [],
    unassigned: { totals: money("0.00"), invoiceCount: 0, lineCount: 0 },
    adjustments: { totals: money("0.00"), counts: emptyCounts() },
    ...input,
  };
}

function year(months: StatisticsYearMonth[]): StatisticsYearResponse {
  return {
    environment: "PRODUCCION",
    year: 2026,
    months,
    notes: [
      {
        id: "nc-1",
        kind: "CREDIT",
        issuedOn: "2026-10-15",
        month: 10,
        noteNumber: "NC-10",
        clientKey: "client:alfa",
        clientName: "Alfa",
        totals: money("-100.00"),
        invoiceId: "fac-1",
        invoiceNumber: "0001-00000010",
      },
      {
        id: "nd-1",
        kind: "DEBIT",
        issuedOn: "2026-11-02",
        month: 11,
        noteNumber: "ND-11",
        clientKey: "client:alfa",
        clientName: "Alfa",
        totals: money("50.00"),
        invoiceId: "fac-1",
        invoiceNumber: "0001-00000010",
      },
    ],
  };
}

const october = month({
  month: 10,
  totals: money("55053800.00"),
  counts: { invoiceCount: 8, creditNoteCount: 1, debitNoteCount: 0, documentCount: 9 },
  invoices: money("55053900.00"),
  notes: money("-100.00"),
  creditNotes: money("-100.00"),
  adjustments: {
    totals: money("-100.00"),
    counts: { invoiceCount: 0, creditNoteCount: 1, debitNoteCount: 0, documentCount: 1 },
  },
  clients: [{
    key: "client:alfa",
    clientId: "alfa",
    identity: "client-id",
    clientCode: "ALFA",
    clientName: "SUCESION DE VALLE ROBERTO",
    labelIssuedAt: 1,
    labelNumber: "A",
    totals: money("55053800.00"),
    counts: { invoiceCount: 8, creditNoteCount: 1, debitNoteCount: 0, documentCount: 9 },
  }],
  rubros: [{
    key: "rubro:rodamientos",
    rubroId: "rodamientos",
    identity: "rubro-id",
    rubroCode: "ROD",
    rubroName: "Rodamientos",
    labelIssuedAt: 1,
    labelSortOrder: 0,
    labelNumber: "A",
    totals: money("55053900.00"),
    lineCount: 3,
    quantity: "4.00",
    invoiceCount: 8,
  }],
});

const november = month({
  month: 11,
  totals: money("10475500.00"),
  counts: { invoiceCount: 2, creditNoteCount: 0, debitNoteCount: 1, documentCount: 3 },
  invoices: money("10475450.00"),
  notes: money("50.00"),
  debitNotes: money("50.00"),
  adjustments: {
    totals: money("50.00"),
    counts: { invoiceCount: 0, creditNoteCount: 0, debitNoteCount: 1, documentCount: 1 },
  },
  clients: [{
    key: "client:alfa",
    clientId: "alfa",
    identity: "client-id",
    clientCode: "ALFA",
    clientName: "SUCESION DE VALLE ROBERTO",
    labelIssuedAt: 2,
    labelNumber: "B",
    totals: money("10475500.00"),
    counts: { invoiceCount: 2, creditNoteCount: 0, debitNoteCount: 1, documentCount: 3 },
  }],
  rubros: [{
    key: "rubro:rodamientos",
    rubroId: "rodamientos",
    identity: "rubro-id",
    rubroCode: "ROD",
    rubroName: "Rodamientos",
    labelIssuedAt: 2,
    labelSortOrder: 0,
    labelNumber: "B",
    totals: money("10475450.00"),
    lineCount: 1,
    quantity: "1.50",
    invoiceCount: 2,
  }],
});

function packageFor(active: StatisticsYearMonth[]): StatisticsYearResponse {
  const byMonth = new Map(active.map((item) => [item.month, item]));
  return year(Array.from({ length: 12 }, (_, index) => byMonth.get(index + 1) ?? month({ month: index + 1 })));
}

describe("combinación de meses", () => {
  const pack = packageFor([october, november]);

  it("suma octubre y noviembre con los centavos de referencia", () => {
    const view = combineStatisticsYear(pack, [10, 11], { year: 2026, month: 11 });

    expect(view?.totals.total).toBe("65529300.00");
    expect(view?.averageTotal).toBe("32764650.00");
    expect(view?.counts).toEqual({
      invoiceCount: 10,
      creditNoteCount: 1,
      debitNoteCount: 1,
      documentCount: 12,
    });
    expect(view?.creditNotes.total).toBe("-100.00");
    expect(view?.debitNotes.total).toBe("50.00");
    expect(view?.reconciliation.notes.total).toBe("-50.00");
    expect(view?.clients[0]?.totals.total).toBe("65529300.00");
    expect(view?.rubros[0]?.name).toBe("Rodamientos");
    expect(view?.rubros[0]?.quantity).toBe("5.50");
    expect(view?.notes.map((note) => note.id)).toEqual(["nc-1", "nd-1"]);
    expect(view?.selectedMonths[1]?.state).toBe("partial");
    expect(view?.selectedMonths[1]?.variation?.referenceName).toBe("Octubre");
    expect(view?.selectedMonths[1]?.variation?.skipped).toBe(false);
    expect(view?.conclusions.some((line) => line.includes("Noviembre está en curso"))).toBe(true);
    expect(view?.conclusions.some((line) => line.includes("Rodamientos"))).toBe(true);
    expect(view?.conclusions.join(" ")).not.toMatch(/porque|debido a|cayó por/i);
  });

  it("no trata un mes futuro como caída y omite el porcentaje si la base no es positiva", () => {
    const december = month({ month: 12 });
    const negative = month({
      month: 10,
      totals: money("-20.00"),
      counts: { invoiceCount: 1, creditNoteCount: 0, debitNoteCount: 0, documentCount: 1 },
    });
    const view = combineStatisticsYear(
      packageFor([negative, december]),
      [10, 12],
      { year: 2026, month: 11 },
    );

    expect(view?.selectedMonths[1]?.state).toBe("future");
    expect(view?.selectedMonths[1]?.variation).toBeNull();
    expect(view?.conclusions.some((line) => line.includes("no se interpreta como una baja"))).toBe(true);
    expect(view?.spreadPercent).toBeNull();
    expect(view?.conclusions.join(" ")).not.toMatch(/\d+,\d+ %/);
  });

  it("marca un mes pasado sin movimientos y no devuelve cifras si no hay selección", () => {
    const view = combineStatisticsYear(pack, [1, 10], { year: 2026, month: 11 });
    expect(view?.selectedMonths[0]?.state).toBe("empty");
    expect(view?.selectedMonths[1]?.variation?.skipped).toBe(true);
    expect(view?.totals.total).toBe("55053800.00");
    expect(combineStatisticsYear(pack, [], { year: 2026, month: 11 })).toBeNull();
  });
});
