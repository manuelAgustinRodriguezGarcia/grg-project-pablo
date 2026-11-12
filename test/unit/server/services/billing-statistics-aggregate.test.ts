import { describe, expect, it } from "vitest";
import {
  buildLibroIvaRows,
  sumLibroIvaRows,
} from "@/features/billing/utils/libro-iva";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";
import {
  aggregateStatistics,
  type StatisticsAggregate,
} from "@/server/services/billing-statistics/aggregate";
import { clientGroupKey, rubroGroupKey } from "@/server/services/billing-statistics/identity";
import { formatMinorUnits } from "@/server/services/billing-statistics/money";
import { statisticsYearRange } from "@/server/services/billing-statistics/periods";
import { presentClients, presentRubros, presentSummary } from "@/server/services/billing-statistics/present";
import type {
  StatisticsInvoiceRecord,
  StatisticsNoteRecord,
} from "@/server/services/billing-statistics/source";

function invoice(
  overrides: Partial<StatisticsInvoiceRecord> = {},
): StatisticsInvoiceRecord {
  return {
    id: "inv-discount",
    issuedAt: new Date(2026, 2, 15, 10, 0, 0),
    invoiceNumber: "0007-00000001",
    clientId: "client-sur",
    clientCode: "CLI-0001",
    clientName: "Taller Sur",
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: "30712345671",
    total: "165.00",
    ivaAmount: "28.64",
    totalVisualRounded: "165.00",
    items: [
      line("rubro-emb", "EMB-0001", "Embragues", "100.00", 0),
      line("rubro-fil", "FIL-0001", "Filtros", "50.00", 1),
      line("rubro-fre", "FRE-0001", "Frenos", "33.33", 2),
    ],
    ...overrides,
  };
}

function line(
  rubroId: string | null,
  rubroCode: string,
  rubroName: string,
  lineTotal: string,
  sortOrder: number,
  quantity = "1.00",
) {
  return { rubroId, rubroCode, rubroName, quantity, lineTotal, sortOrder };
}

function note(overrides: Partial<StatisticsNoteRecord> = {}): StatisticsNoteRecord {
  return {
    id: "note-credit",
    kind: "CREDIT",
    issuedAt: new Date(2026, 2, 20, 11, 0, 0),
    noteNumber: "0007-00000002",
    invoiceId: "inv-1",
    invoiceNumber: "0007-00000001",
    clientId: "client-sur",
    clientCode: "CLI-0001",
    clientName: "Taller Sur",
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: "30712345671",
    netAmount: "41.32",
    ivaAmount: "8.68",
    amount: "50.00",
    ...overrides,
  };
}

function rubroTotal(aggregate: StatisticsAggregate, name: string): string {
  const match = [...aggregate.rubros.values()].find((rubro) => rubro.rubroName === name);
  if (!match) {
    throw new Error(`No está el rubro ${name}.`);
  }
  return formatMinorUnits(match.totals.totalCents);
}

describe("agregado de estadísticas", () => {
  it("distribuye una factura con descuento y varios rubros sin perder centavos", () => {
    const aggregate = aggregateStatistics({ invoices: [invoice()], notes: [] });
    const report = presentRubros({
      environment: "MODO_PRUEBA",
      period: { mode: "month", range: { from: new Date(2026, 2, 1), to: new Date(2026, 3, 1) } },
      current: aggregate,
      comparison: null,
      limit: null,
      rubroKey: null,
    });

    expect(rubroTotal(aggregate, "Embragues")).toBe("90.00");
    expect(rubroTotal(aggregate, "Filtros")).toBe("45.00");
    expect(rubroTotal(aggregate, "Frenos")).toBe("30.00");
    expect(report.reconciliation.rubros.total).toBe("165.00");
    expect(report.reconciliation.rubros.net).toBe("136.36");
    expect(report.reconciliation.rubros.vat).toBe("28.64");
    expect(report.reconciliation.distributionMatchGeneral).toBe(true);
    expect(report.reconciliation.clientsMatchGeneral).toBe(true);
    expect(report.adjustments.totals.total).toBe("0.00");
    expect(report.ranking.rows.map((row) => row.totals.total)).toEqual([
      "90.00",
      "45.00",
      "30.00",
    ]);
    expect(report.ranking.rows[0]?.invoiceCount).toBe(1);
    expect(report.ranking.rows[0]?.lineCount).toBe(1);
  });

  it("conserva el hueco del total visual en cada línea", () => {
    const aggregate = aggregateStatistics({
      invoices: [
        invoice({
          id: "inv-visual",
          total: "121.40",
          ivaAmount: "21.07",
          totalVisualRounded: "121.00",
          items: [
            line("rubro-a", "A-0001", "Mayor", "70.00", 0),
            line("rubro-b", "B-0001", "Menor", "51.40", 1),
          ],
        }),
      ],
      notes: [],
    });
    const rows = [...aggregate.rubros.values()].sort((left, right) =>
      left.rubroName.localeCompare(right.rubroName, "es-AR"),
    );

    expect(formatMinorUnits(rows[0]?.totals.totalCents ?? BigInt(0))).toBe("69.77");
    expect(formatMinorUnits(rows[0]?.totals.netCents ?? BigInt(0))).toBe("57.85");
    expect(formatMinorUnits(rows[0]?.totals.vatCents ?? BigInt(0))).toBe("12.15");
    expect(formatMinorUnits(rows[1]?.totals.totalCents ?? BigInt(0))).toBe("51.23");
    expect(formatMinorUnits(rows[1]?.totals.netCents ?? BigInt(0))).toBe("42.48");
    expect(formatMinorUnits(rows[1]?.totals.vatCents ?? BigInt(0))).toBe("8.92");
    expect(formatMinorUnits(
      (rows[0]?.totals.totalCents ?? BigInt(0)) + (rows[1]?.totals.totalCents ?? BigInt(0)),
    )).toBe("121.00");
    expect(presentSummary({
      environment: "MODO_PRUEBA",
      period: { mode: "month", range: { from: new Date(2026, 2, 1), to: new Date(2026, 3, 1) } },
      current: aggregate,
      comparison: null,
    }).totals.roundingGap).toBe("-0.40");
  });

  it("coincide con los importes del Libro de IVA y no resta la nota dos veces", () => {
    const sourceInvoice = invoice();
    const sourceNote = note();
    const aggregate = aggregateStatistics({
      invoices: [sourceInvoice],
      notes: [sourceNote],
    });
    const rows = buildLibroIvaRows(
      [
        {
          issuedAt: sourceInvoice.issuedAt,
          invoiceType: "A",
          pointOfSale: "0007",
          invoiceNumber: sourceInvoice.invoiceNumber,
          clientName: sourceInvoice.clientName,
          clientIdentificationType: "CUIT",
          clientIdentificationNumber: sourceInvoice.clientIdentificationNumber,
          clientIvaCondition: "RESPONSABLE_INSCRIPTO",
          subtotal: 136.36,
          discountAmount: 15.15,
          ivaPercent: 21,
          ivaAmount: 28.64,
          total: 165,
          totalVisualRounded: 165,
        },
      ],
      [
        {
          kind: "CREDIT",
          issuedAt: sourceNote.issuedAt,
          invoiceType: "A",
          pointOfSale: "0007",
          noteNumber: sourceNote.noteNumber,
          invoiceNumber: sourceInvoice.invoiceNumber,
          clientName: sourceNote.clientName,
          clientIdentificationType: "CUIT",
          clientIdentificationNumber: sourceNote.clientIdentificationNumber,
          clientIvaCondition: "RESPONSABLE_INSCRIPTO",
          netAmount: 41.32,
          ivaPercent: 21,
          ivaAmount: 8.68,
          amount: 50,
        },
      ],
    );
    const book = sumLibroIvaRows(rows);

    expect(pesosToCents(book.total)).toBe(Number(aggregate.totals.totalCents));
    expect(pesosToCents(book.netAmount)).toBe(Number(aggregate.totals.netCents));
    expect(pesosToCents(book.ivaAmount)).toBe(Number(aggregate.totals.vatCents));
    expect(aggregate.totals.totalCents).toBe(BigInt(11500));
    expect(aggregate.rubros.size).toBe(3);
    expect(aggregate.adjustments.totals.totalCents).toBe(BigInt(-5000));
    expect(aggregate.counts).toEqual({
      invoiceCount: 1,
      creditNoteCount: 1,
      debitNoteCount: 0,
      documentCount: 2,
    });
  });

  it("deja la factura en su mes y la nota de anulación en el mes de emisión", () => {
    const issued = invoice({
      total: "121.00",
      ivaAmount: "21.00",
      totalVisualRounded: "121.00",
      items: [line("rubro-a", "A-0001", "Filtros", "121.00", 0)],
    });
    const credit = note({
      issuedAt: new Date(2026, 3, 2),
      netAmount: "100.00",
      ivaAmount: "21.00",
      amount: "121.00",
    });
    const march = aggregateStatistics({ invoices: [issued], notes: [] });
    const april = aggregateStatistics({ invoices: [], notes: [credit] });
    const year = aggregateStatistics({ invoices: [issued], notes: [credit] });

    expect(march.totals.totalCents).toBe(BigInt(12100));
    expect(march.rubros.size).toBe(1);
    expect(april.totals.totalCents).toBe(BigInt(-12100));
    expect(april.rubros.size).toBe(0);
    expect(april.adjustments.totals.totalCents).toBe(BigInt(-12100));
    expect(year.totals.totalCents).toBe(BigInt(0));
    expect([...year.rubros.values()][0]?.totals.totalCents).toBe(BigInt(12100));
  });

  it("no atribuye notas al rubro y separa los importes sin líneas", () => {
    const aggregate = aggregateStatistics({
      invoices: [
        invoice(),
        invoice({ id: "inv-empty", items: [] }),
        invoice({
          id: "inv-negative-line",
          invoiceNumber: "0007-00000008",
          items: [
            line("rubro-a", "A-0001", "Filtros", "10.00", 0),
            line("rubro-b", "B-0001", "Frenos", "-1.00", 1),
          ],
        }),
      ],
      notes: [
        note(),
        note({
          id: "note-debit",
          kind: "DEBIT",
          noteNumber: "0007-00000003",
          netAmount: "10.00",
          ivaAmount: "2.10",
          amount: "12.10",
        }),
      ],
    });
    const report = presentRubros({
      environment: "PRODUCCION",
      period: { mode: "month", range: { from: new Date(2026, 2, 1), to: new Date(2026, 3, 1) } },
      current: aggregate,
      comparison: null,
      limit: null,
      rubroKey: "adjustments",
    });

    expect(aggregate.rubros.size).toBe(3);
    expect(aggregate.unassigned.invoiceCount).toBe(2);
    expect(report.adjustments.counts).toEqual({
      invoiceCount: 0,
      creditNoteCount: 1,
      debitNoteCount: 1,
      documentCount: 2,
    });
    expect(report.reconciliation.distributionMatchGeneral).toBe(true);
    expect(report.entity?.kind).toBe("adjustments");
  });

  it("agrupa clientes y rubros históricos sin usar la ficha viva", () => {
    const deletedClient = invoice({
      id: "inv-deleted-client",
      clientId: null,
      clientCode: "CLI-0099",
      clientName: "Cliente borrado",
      clientIdentificationNumber: "20123456789",
    });
    const reusedCode = invoice({
      id: "inv-reused",
      invoiceNumber: "0007-00000009",
      clientId: "client-new",
      clientCode: "CLI-0099",
      clientName: "Cliente nuevo",
    });
    const renamed = invoice({
      id: "inv-renamed",
      invoiceNumber: "0007-00000010",
      issuedAt: new Date(2026, 2, 28),
      clientName: "Taller Sur actualizado",
      items: [line("rubro-emb", "EMB-0002", "Embrague", "100.00", 0)],
    });
    const deletedRubro = invoice({
      id: "inv-deleted-rubro",
      invoiceNumber: "0007-00000011",
      items: [line(null, "FRE-0001", "Frenos", "40.00", 0)],
    });
    const aggregate = aggregateStatistics({
      invoices: [invoice(), deletedClient, reusedCode, renamed, deletedRubro],
      notes: [
        note({
          id: "note-other-client",
          clientId: "client-norte",
          clientCode: "CLI-0002",
          clientName: "Taller Norte",
          clientIdentificationNumber: "30700000001",
        }),
      ],
    });
    const deletedKey = clientGroupKey({
      clientId: null,
      clientCode: "CLI-0099",
      clientName: "Cliente borrado",
      clientIdentificationType: "CUIT",
      clientIdentificationNumber: "20123456789",
    });
    const liveRubro = rubroGroupKey({
      rubroId: "rubro-fre",
      rubroCode: "FRE-0001",
      rubroName: "Frenos",
    });
    const historicalRubro = rubroGroupKey({
      rubroId: null,
      rubroCode: "FRE-0001",
      rubroName: "Frenos",
    });

    expect(aggregate.clients.get("client:client-sur")?.clientName).toBe(
      "Taller Sur actualizado",
    );
    expect(aggregate.clients.get("client:client-sur")?.snapshotNames.size).toBe(2);
    expect(aggregate.clients.has(deletedKey)).toBe(true);
    expect(aggregate.clients.has("client:client-new")).toBe(true);
    expect(aggregate.clients.get("client:client-new")?.key).not.toBe(deletedKey);
    expect(aggregate.clients.get("client:client-norte")?.totals.totalCents).toBe(BigInt(-5000));
    expect(aggregate.rubros.get("rubro:rubro-emb")?.rubroName).toBe("Embrague");
    expect(aggregate.rubros.get("rubro:rubro-emb")?.snapshotNames.size).toBe(2);
    expect(liveRubro).not.toBe(historicalRubro);
    expect(aggregate.rubros.has(liveRubro)).toBe(true);
    expect(aggregate.rubros.has(historicalRubro)).toBe(true);
  });

  it("ordena el ranking por importe, incluye ceros y negativos, y no duplica comprobantes", () => {
    const alfaInvoice = invoice({
      id: "alfa",
      clientId: "alfa",
      clientName: "Alfa",
      total: "200.00",
      ivaAmount: "0.00",
      totalVisualRounded: "200.00",
      items: [
        line("rubro-a", "A-0001", "Alfa rubro", "100.00", 0, "2.50"),
        line("rubro-a", "A-0001", "Alfa rubro", "100.00", 1, "1.25"),
      ],
    });
    const aggregate = aggregateStatistics({
      invoices: [
        alfaInvoice,
        invoice({ ...alfaInvoice, totalVisualRounded: "9999.00" }),
        invoice({
          id: "beta",
          clientId: "beta",
          clientName: "Beta",
          total: "200.00",
          ivaAmount: "0.00",
          totalVisualRounded: "200.00",
          items: [line("rubro-b", "B-0001", "Beta rubro", "200.00", 0)],
        }),
        invoice({
          id: "zulu",
          clientId: "zulu",
          clientName: "Zulu",
          total: "40.00",
          ivaAmount: "0.00",
          totalVisualRounded: "40.00",
          items: [line("rubro-z", "Z-0001", "Zulu rubro", "40.00", 0)],
        }),
        invoice({
          id: "cero",
          clientId: "cero",
          clientName: "Cero",
          total: "0.00",
          ivaAmount: "0.00",
          totalVisualRounded: "0.00",
          items: [line("rubro-c", "C-0001", "Cero rubro", "0.00", 0)],
        }),
      ],
      notes: [
        note({
          id: "negativo",
          clientId: "negativo",
          clientName: "Negativo",
          netAmount: "50.00",
          ivaAmount: "0.00",
          amount: "50.00",
        }),
        note({
          id: "zero-note",
          clientId: "cero",
          clientName: "Cero",
          netAmount: "0.00",
          ivaAmount: "0.00",
          amount: "0.00",
        }),
      ],
    });
    const report = presentClients({
      environment: "MODO_PRUEBA",
      period: { mode: "year", range: statisticsYearRange(2026) },
      current: aggregate,
      comparison: null,
      limit: 2,
      clientKey: "client:alfa",
    });
    const alfa = aggregate.rubros.get("rubro:rubro-a");

    expect(report.ranking.totalGroups).toBe(5);
    expect(report.ranking.rows.map((row) => [row.clientName, row.rank, row.totals.total])).toEqual([
      ["Alfa", 1, "200.00"],
      ["Beta", 1, "200.00"],
    ]);
    expect(report.ranking.rows[0]?.sharePercent).toBe("51.28");
    expect(aggregate.clients.get("client:negativo")?.totals.totalCents).toBe(BigInt(-5000));
    expect(aggregate.counts.invoiceCount).toBe(4);
    expect(aggregate.counts.creditNoteCount).toBe(2);
    expect(alfa?.lineCount).toBe(2);
    expect(alfa?.invoiceIds.size).toBe(1);
    expect(formatMinorUnits(alfa?.quantityHundredths ?? BigInt(0))).toBe("3.75");
    expect(report.monthly).toHaveLength(12);
    expect(report.monthly[0]?.totals.total).toBe("0.00");
    expect(report.monthly[2]?.totals.total).toBe(report.totals.total);
    expect(report.entity?.found).toBe(true);
    expect(report.entity?.monthly[2]?.totals.total).toBe("200.00");
    expect(JSON.stringify(report)).not.toContain("30712345671");
  });

  it("suma una factura B desde los importes guardados", () => {
    const aggregate = aggregateStatistics({
      invoices: [
        invoice({
          id: "factura-b",
          total: "121.00",
          ivaAmount: "21.00",
          totalVisualRounded: "121.00",
          items: [line("rubro-b", "B-0001", "Filtros B", "121.00", 0)],
        }),
      ],
      notes: [],
    });

    expect(formatMinorUnits(aggregate.totals.netCents)).toBe("100.00");
    expect(formatMinorUnits(aggregate.totals.vatCents)).toBe("21.00");
    expect(formatMinorUnits(aggregate.totals.totalCents)).toBe("121.00");
  });

  it("oculta el porcentaje cuando la anulación deja el período en cero", () => {
    const aggregate = aggregateStatistics({
      invoices: [
        invoice({
          total: "100.00",
          ivaAmount: "0.00",
          totalVisualRounded: "100.00",
          items: [line("rubro-a", "A-0001", "Filtros", "100.00", 0)],
        }),
      ],
      notes: [
        note({
          netAmount: "100.00",
          ivaAmount: "0.00",
          amount: "100.00",
        }),
      ],
    });
    const report = presentRubros({
      environment: "HOMOLOGACION",
      period: { mode: "month", range: { from: new Date(2026, 2, 1), to: new Date(2026, 3, 1) } },
      current: aggregate,
      comparison: null,
      limit: null,
      rubroKey: null,
    });

    expect(report.totals.total).toBe("0.00");
    expect(report.ranking.rows[0]?.totals.total).toBe("100.00");
    expect(report.ranking.rows[0]?.sharePercent).toBeNull();
    expect(report.ranking.rows[0]?.shareUnavailableReason).toBe("ZERO_TOTAL");
    expect(report.adjustments.totals.total).toBe("-100.00");
    expect(report.adjustments.sharePercent).toBeNull();
    expect(report.reconciliation.distributionMatchGeneral).toBe(true);
  });
});
