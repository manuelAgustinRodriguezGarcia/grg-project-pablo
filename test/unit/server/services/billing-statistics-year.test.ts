import { describe, expect, it } from "vitest";
import { aggregateStatistics } from "@/server/services/billing-statistics/aggregate";
import { presentClients, presentRubros, presentSummary } from "@/server/services/billing-statistics/present";
import { statisticsMonthRange, statisticsYearRange } from "@/server/services/billing-statistics/periods";
import type { StatisticsSource } from "@/server/services/billing-statistics/source";
import { presentStatisticsYear } from "@/server/services/billing-statistics/year";
import { combineStatisticsYear } from "@/features/billing/utils/billing-statistics-combine";

function invoice(input: {
  id: string;
  month: number;
  day?: number;
  total: string;
  clientId: string;
  clientName: string;
  rubroId: string;
  rubroName: string;
}) {
  return {
    id: input.id,
    issuedAt: new Date(2026, input.month - 1, input.day ?? 10),
    invoiceNumber: input.id,
    clientId: input.clientId,
    clientCode: input.clientId,
    clientName: input.clientName,
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: "30712345671",
    total: input.total,
    ivaAmount: "0.00",
    totalVisualRounded: input.total,
    items: [{
      rubroId: input.rubroId,
      rubroCode: input.rubroId,
      rubroName: input.rubroName,
      quantity: "2.00",
      lineTotal: input.total,
      sortOrder: 0,
    }],
  };
}

const source: StatisticsSource = {
  invoices: [
    invoice({
      id: "fac-oct",
      month: 10,
      total: "1000.00",
      clientId: "alfa",
      clientName: "SUCESION DE VALLE ROBERTO",
      rubroId: "filtros",
      rubroName: "Filtros",
    }),
    invoice({
      id: "fac-dic",
      month: 12,
      total: "400.00",
      clientId: "beta",
      clientName: "PLANJAR ALEXIS DAMIAN",
      rubroId: "frenos",
      rubroName: "Frenos",
    }),
  ],
  notes: [
    {
      id: "nc-oct",
      kind: "CREDIT",
      issuedAt: new Date(2026, 9, 20),
      noteNumber: "NC-1",
      invoiceId: "fac-oct",
      invoiceNumber: "fac-oct",
      clientId: "alfa",
      clientCode: "alfa",
      clientName: "SUCESION DE VALLE ROBERTO",
      clientIdentificationType: "CUIT",
      clientIdentificationNumber: "30712345671",
      netAmount: "100.00",
      ivaAmount: "0.00",
      amount: "100.00",
    },
    {
      id: "nd-nov",
      kind: "DEBIT",
      issuedAt: new Date(2026, 10, 4),
      noteNumber: "ND-1",
      invoiceId: "fac-oct",
      invoiceNumber: "fac-oct",
      clientId: "beta",
      clientCode: "beta",
      clientName: "PLANJAR ALEXIS DAMIAN",
      clientIdentificationType: "CUIT",
      clientIdentificationNumber: "30712345671",
      netAmount: "50.00",
      ivaAmount: "0.00",
      amount: "50.00",
    },
  ],
};

describe("paquete anual de estadísticas", () => {
  const aggregate = aggregateStatistics(source);
  const year = presentStatisticsYear({
    environment: "PRODUCCION",
    year: 2026,
    aggregate,
    source,
  });

  it("cierra los doce meses con el total anual del motor", () => {
    const summary = presentSummary({
      environment: "PRODUCCION",
      period: { mode: "year", range: statisticsYearRange(2026) },
      current: aggregate,
      comparison: null,
    });
    const summed = year.months.reduce(
      (total, month) => total + Number(month.totals.total),
      0,
    );

    expect(year.months).toHaveLength(12);
    expect(summed.toFixed(2)).toBe(summary.totals.total);
    expect(summary.totals.total).toBe("1350.00");
    expect(JSON.stringify(year)).not.toContain("30712345671");
  });

  it("separa crédito y débito sin inferirlos del neto", () => {
    expect(year.months[9]?.creditNotes.total).toBe("-100.00");
    expect(year.months[9]?.debitNotes.total).toBe("0.00");
    expect(year.months[10]?.debitNotes.total).toBe("50.00");
    expect(year.months[10]?.creditNotes.total).toBe("0.00");
    expect(year.months[9]?.notes.total).toBe("-100.00");
    expect(year.months[9]?.adjustments.totals.total).toBe("-100.00");
    expect(year.notes.map((note) => [note.kind, note.invoiceId, note.totals.total])).toEqual([
      ["DEBIT", "fac-oct", "50.00"],
      ["CREDIT", "fac-oct", "-100.00"],
    ]);
  });

  it("coincide con el mes que calcularía el motor por separado", () => {
    const october = aggregateStatistics({
      invoices: source.invoices.filter((item) => item.id === "fac-oct"),
      notes: source.notes.filter((item) => item.id === "nc-oct"),
    });
    const summary = presentSummary({
      environment: "PRODUCCION",
      period: { mode: "month", range: statisticsMonthRange(2026, 10) },
      current: october,
      comparison: null,
    });
    const clients = presentClients({
      environment: "PRODUCCION",
      period: { mode: "month", range: statisticsMonthRange(2026, 10) },
      current: october,
      comparison: null,
      limit: null,
      clientKey: null,
    });
    const rubros = presentRubros({
      environment: "PRODUCCION",
      period: { mode: "month", range: statisticsMonthRange(2026, 10) },
      current: october,
      comparison: null,
      limit: null,
      rubroKey: null,
    });

    expect(year.months[9]?.totals).toEqual(summary.totals);
    expect(year.months[9]?.counts).toEqual(summary.counts);
    expect(year.months[9]?.clients.map((client) => [client.clientName, client.totals.total])).toEqual(
      clients.ranking.rows.map((row) => [row.clientName, row.totals.total]),
    );
    expect(year.months[9]?.rubros.map((rubro) => [rubro.rubroName, rubro.totals.total])).toEqual(
      rubros.ranking.rows.map((row) => [row.rubroName, row.totals.total]),
    );
  });

  it("suma meses no consecutivos sin arrastrar el mes salteado", () => {
    const view = combineStatisticsYear(year, [10, 12], { year: 2026, month: 12 });

    expect(view?.totals.total).toBe("1300.00");
    expect(view?.clients.map((client) => [client.name, client.totals.total])).toEqual([
      ["SUCESION DE VALLE ROBERTO", "900.00"],
      ["PLANJAR ALEXIS DAMIAN", "400.00"],
    ]);
    expect(view?.rubros.map((rubro) => [rubro.name, rubro.totals.total])).toEqual([
      ["Filtros", "1000.00"],
      ["Frenos", "400.00"],
    ]);
    expect(view?.reconciliation.distributionMatchGeneral).toBe(true);
    expect(view?.reconciliation.clientsMatchGeneral).toBe(true);
    expect(view?.notes).toHaveLength(1);
    expect(view?.notes[0]?.id).toBe("nc-oct");
  });
});
