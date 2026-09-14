import { describe, expect, it } from "vitest";
import {
  buildLibroIvaAbSummary,
  buildLibroIvaDailyBlocks,
  buildLibroIvaRows,
  buildLibroIvaZSimpleSections,
  libroIvaCustomPeriodLabel,
  libroIvaCustomRange,
  libroIvaDayRange,
  libroIvaMonthRange,
  libroIvaRowsForLetter,
  parseYearMonthValue,
  sumLibroIvaRows,
  toYearMonthValue,
  type LibroIvaInvoiceSource,
  type LibroIvaNoteSource,
} from "@/features/billing/utils/libro-iva";

function invoice(
  overrides: Partial<LibroIvaInvoiceSource> = {},
): LibroIvaInvoiceSource {
  return {
    issuedAt: new Date("2026-08-10T12:00:00"),
    invoiceType: "A",
    pointOfSale: "0007",
    invoiceNumber: "0007-PRUEBA-000000001",
    clientName: "Taller Méndez",
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: "30500010912",
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    subtotal: 1000,
    discountAmount: 0,
    ivaPercent: 21,
    ivaAmount: 210,
    total: 1210,
    totalVisualRounded: 1210,
    ...overrides,
  };
}

function note(
  overrides: Partial<LibroIvaNoteSource> = {},
): LibroIvaNoteSource {
  return {
    kind: "CREDIT",
    issuedAt: new Date("2026-08-12T12:00:00"),
    invoiceType: "A",
    pointOfSale: "0007",
    noteNumber: "0007-PRUEBA-NC-000000001",
    invoiceNumber: "0007-PRUEBA-000000001",
    clientName: "Taller Méndez",
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: "30500010912",
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    netAmount: 200,
    ivaPercent: 21,
    ivaAmount: 42,
    amount: 242,
    ...overrides,
  };
}

describe("libroIvaMonthRange", () => {
  it("cubre el mes calendario local", () => {
    expect(libroIvaMonthRange(2026, 8)).toEqual({
      from: new Date(2026, 7, 1),
      to: new Date(2026, 8, 1),
    });
  });
});

describe("year-month value", () => {
  it("parsea y formatea YYYY-MM", () => {
    expect(parseYearMonthValue("2026-08")).toEqual({ year: 2026, month: 8 });
    expect(parseYearMonthValue("2026-13")).toBeNull();
    expect(toYearMonthValue(new Date(2026, 7, 28))).toBe("2026-08");
  });
});

describe("buildLibroIvaRows", () => {
  it("suma facturas y ND, resta NC, y no mezcla letras", () => {
    const rows = buildLibroIvaRows(
      [
        invoice(),
        invoice({
          invoiceType: "B",
          invoiceNumber: "0007-PRUEBA-000000002",
          subtotal: 500,
          ivaPercent: 21,
          ivaAmount: 105,
          total: 605,
          totalVisualRounded: 605,
        }),
      ],
      [
        note(),
        note({
          kind: "DEBIT",
          noteNumber: "0007-PRUEBA-ND-000000001",
          netAmount: 100,
          ivaPercent: 21,
          ivaAmount: 21,
          amount: 121,
        }),
      ],
    );

    const sheetA = libroIvaRowsForLetter(rows, "A");
    const sheetB = libroIvaRowsForLetter(rows, "B");
    const totalsA = sumLibroIvaRows(sheetA);

    expect(sheetA).toHaveLength(3);
    expect(sheetB).toHaveLength(1);
    expect(sheetA.map((row) => row.docKind)).toEqual(["FACTURA", "NC", "ND"]);
    expect(totalsA).toEqual({
      netAmount: 900,
      ivaAmount: 189,
      total: 1089,
    });
    expect(sheetB[0]?.total).toBe(605);
    expect(rows.some((row) => row.docKind === "FACTURA" && row.associatedNumber === "")).toBe(
      true,
    );
  });

  it("no incluye recibos porque no recibe ese tipo de comprobante", () => {
    const rows = buildLibroIvaRows([invoice()], []);
    expect(rows.every((row) => row.docKind !== "NC" && row.docKind !== "ND")).toBe(
      true,
    );
    expect(rows).toHaveLength(1);
  });
});

describe("Libro IVA diario", () => {
  it("cubre un día calendario local", () => {
    expect(libroIvaDayRange(2026, 8, 10)).toEqual({
      from: new Date(2026, 7, 10),
      to: new Date(2026, 7, 11),
    });
  });
});

describe("Libro IVA personalizado", () => {
  it("cubre el rango inclusivo entre fechas", () => {
    expect(libroIvaCustomRange("2026-08-01", "2026-08-15")).toEqual({
      from: new Date(2026, 7, 1),
      to: new Date(2026, 7, 16),
    });
  });

  it("rechaza desde posterior a hasta", () => {
    expect(() => libroIvaCustomRange("2026-08-20", "2026-08-10")).toThrow(
      "La fecha desde no puede ser posterior a la fecha hasta.",
    );
  });

  it("formatea el período para el output", () => {
    expect(libroIvaCustomPeriodLabel("2026-08-01", "2026-08-15")).toMatch(
      /2026/,
    );
  });
});

describe("Libro IVA diario blocks", () => {
  it("resume cada tipo con comprobante inicial y final", () => {
    const rows = buildLibroIvaRows(
      [
        invoice({ invoiceNumber: "0007-PRUEBA-000000001" }),
        invoice({ invoiceNumber: "0007-PRUEBA-000000003" }),
        invoice({
          invoiceType: "B",
          invoiceNumber: "0007-PRUEBA-000000002",
          subtotal: 500,
          ivaAmount: 105,
          total: 605,
          totalVisualRounded: 605,
        }),
      ],
      [],
    );

    const blocks = buildLibroIvaDailyBlocks(rows);
    const facturasA = blocks.find(
      (block) => block.docKind === "FACTURA" && block.letter === "A",
    );
    const facturasB = blocks.find(
      (block) => block.docKind === "FACTURA" && block.letter === "B",
    );
    const notasCredito = blocks.find((block) => block.docKind === "NC");
    const notasDebito = blocks.find((block) => block.docKind === "ND");

    expect(blocks).toHaveLength(4);
    expect(facturasA?.displayRows.map((row) => row.number)).toEqual([
      "0007-PRUEBA-000000001",
      "0007-PRUEBA-000000003",
    ]);
    expect(facturasA?.totals.total).toBe(2420);
    expect(facturasB?.displayRows).toHaveLength(1);
    expect(facturasB?.first?.number).toBe(facturasB?.last?.number);
    expect(notasCredito?.title).toBe("Notas de crédito");
    expect(notasCredito?.showLetterColumn).toBe(true);
    expect(notasDebito?.title).toBe("Notas de débito");
    expect(notasDebito?.showLetterColumn).toBe(true);
  });

  it("agrupa notas de crédito A y B en una sola tabla con letra", () => {
    const rows = buildLibroIvaRows(
      [],
      [
        note({
          kind: "CREDIT",
          invoiceType: "A",
          noteNumber: "0007-PRUEBA-NC-000000001",
        }),
        note({
          kind: "CREDIT",
          invoiceType: "A",
          noteNumber: "0007-PRUEBA-NC-000000003",
        }),
        note({
          kind: "CREDIT",
          invoiceType: "B",
          noteNumber: "0007-PRUEBA-NC-000000002",
          amount: 200,
          ivaAmount: 42,
          netAmount: 158,
        }),
      ],
    );

    const notasCredito = buildLibroIvaDailyBlocks(rows).find(
      (block) => block.docKind === "NC",
    );

    expect(notasCredito?.title).toBe("Notas de crédito");
    expect(notasCredito?.displayRows.map((row) => [row.letter, row.number])).toEqual([
      ["A", "0007-PRUEBA-NC-000000001"],
      ["A", "0007-PRUEBA-NC-000000003"],
      ["B", "0007-PRUEBA-NC-000000002"],
    ]);
  });

  it("arma el Informe Z simple con dos secciones de totales", () => {
    const rows = buildLibroIvaRows(
      [
        invoice({ invoiceNumber: "0007-PRUEBA-000000001" }),
        invoice({ invoiceNumber: "0007-PRUEBA-000000003" }),
        invoice({
          invoiceType: "B",
          invoiceNumber: "0007-PRUEBA-000000002",
          subtotal: 500,
          ivaAmount: 105,
          total: 605,
          totalVisualRounded: 605,
        }),
      ],
      [
        note({
          kind: "CREDIT",
          noteNumber: "0007-PRUEBA-NC-000000001",
        }),
        note({
          kind: "DEBIT",
          invoiceType: "B",
          noteNumber: "0007-PRUEBA-ND-000000001",
          amount: 121,
          ivaAmount: 21,
          netAmount: 100,
        }),
      ],
    );

    const sections = buildLibroIvaZSimpleSections(rows);
    expect(sections.map((section) => section.title)).toEqual([
      "TOTAL DE VENTAS DIARIO",
      "TOTAL DE NOTAS DE CREDITO Y NOTAS DE DEBITO",
    ]);
    expect(sections[0]?.rows.map((row) => row.tipo)).toEqual([
      "Factura A",
      "Factura B",
    ]);
    expect(sections[0]?.rows[0]).toMatchObject({
      numberFrom: "0007-PRUEBA-000000001",
      numberTo: "0007-PRUEBA-000000003",
      ivaPercent: 21,
    });
    expect(sections[1]?.rows.map((row) => row.tipo)).toEqual(["NC A", "ND B"]);
  });
});

describe("buildLibroIvaAbSummary", () => {
  it("resume A y B con NC restando, ND sumando e IVA de configuración", () => {
    const rows = buildLibroIvaRows(
      [
        invoice({
          invoiceType: "A",
          totalVisualRounded: 1210,
          ivaAmount: 210,
          total: 1210,
        }),
        invoice({
          invoiceType: "B",
          invoiceNumber: "0007-PRUEBA-000000002",
          totalVisualRounded: 605,
          ivaAmount: 105,
          total: 605,
        }),
      ],
      [
        note({
          kind: "CREDIT",
          invoiceType: "A",
          amount: 242,
          ivaAmount: 42,
          netAmount: 200,
        }),
        note({
          kind: "DEBIT",
          invoiceType: "B",
          noteNumber: "0007-PRUEBA-ND-000000001",
          amount: 121,
          ivaAmount: 21,
          netAmount: 100,
        }),
      ],
    );

    const summary = buildLibroIvaAbSummary(rows, {
      pointOfSale: "0007",
      ivaPercent: 21,
    });

    expect(summary.rows).toEqual([
      {
        pointOfSale: "0007",
        letter: "A",
        total: 968,
        ivaPercent: 21,
        netAmount: 800,
        ivaAmount: 168,
      },
      {
        pointOfSale: "0007",
        letter: "B",
        total: 726,
        ivaPercent: 21,
        netAmount: 600,
        ivaAmount: 126,
      },
    ]);
    expect(summary.totals).toEqual({
      total: 1694,
      netAmount: 1400,
      ivaAmount: 294,
    });
  });
});
