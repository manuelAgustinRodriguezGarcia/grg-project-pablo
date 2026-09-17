import { describe, expect, it } from "vitest";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import {
  buildBillingDashboardMetrics,
  buildCollectionSlices,
  formatAmountTrend,
  invoicesInCalendarMonth,
  listTopRubrosByBilling,
  listUnpaidInvoicesForDashboard,
} from "@/features/billing/utils/billing-metrics";

function invoice(
  overrides: Partial<BillingInvoiceListItem> = {},
): BillingInvoiceListItem {
  const paymentStatus = overrides.paymentStatus ?? "PAGA";
  const totalVisualRounded = overrides.totalVisualRounded ?? 100;
  const paymentMethod =
    overrides.paymentMethod ??
    (paymentStatus === "PAGA" ? "CONTADO" : "CUENTA_CORRIENTE");

  return {
    id: "inv-1",
    environment: "MODO_PRUEBA",
    fiscalStatus: "MODO_PRUEBA",
    invoiceType: "B",
    pointOfSale: "0007",
    invoiceNumber: "0007-PRUEBA-000000001",
    issuedAt: new Date("2026-09-01T15:00:00"),
    clientId: "client-1",
    clientCode: "C-0001",
    clientName: "Taller Méndez",
    clientAddress: null,
    clientCity: null,
    clientProvince: null,
    clientEmail: null,
    clientWhatsapp: null,
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: "30500010912",
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    subtotal: 100,
    discountPercent: 0,
    discountAmount: 0,
    ivaPercent: 21,
    ivaAmount: 0,
    total: 100,
    totalVisualRounded,
    paymentMethod,
    paymentStatus,
    notes: null,
    items: [],
    createdAt: new Date("2026-09-01T15:00:00"),
    outstandingAmount:
      overrides.outstandingAmount ??
      (paymentStatus === "PAGA" ? 0 : totalVisualRounded),
    creditNoteCap: overrides.creditNoteCap ?? totalVisualRounded,
    receipts: [],
    billingNotes: [],
    printedAt: null,
    downloadedAt: null,
    sharedAt: null,
    ...overrides,
  };
}

describe("invoicesInCalendarMonth", () => {
  it("incluye solo el mes calendario pedido", () => {
    const invoices = [
      invoice({ id: "sep", issuedAt: new Date("2026-09-15T12:00:00") }),
      invoice({ id: "aug", issuedAt: new Date("2026-08-31T12:00:00") }),
    ];

    expect(
      invoicesInCalendarMonth(invoices, { year: 2026, month: 9 }).map(
        (item) => item.id,
      ),
    ).toEqual(["sep"]);
  });
});

describe("listTopRubrosByBilling", () => {
  it("ordena por monto de renglón y cuenta facturas distintas", () => {
    const invoices = [
      invoice({
        id: "a",
        items: [
          {
            id: "i1",
            rubroId: "embragues",
            rubroCode: "EMB",
            rubroName: "Embragues",
            description: "Kit",
            quantity: 1,
            unitPrice: 300,
            lineTotal: 300,
            sortOrder: 0,
          },
        ],
      }),
      invoice({
        id: "b",
        items: [
          {
            id: "i2",
            rubroId: "embragues",
            rubroCode: "EMB",
            rubroName: "Embragues",
            description: "Disco",
            quantity: 1,
            unitPrice: 200,
            lineTotal: 200,
            sortOrder: 0,
          },
          {
            id: "i3",
            rubroId: "filtros",
            rubroCode: "FIL",
            rubroName: "Filtros",
            description: "Aceite",
            quantity: 1,
            unitPrice: 400,
            lineTotal: 400,
            sortOrder: 1,
          },
        ],
      }),
    ];

    expect(listTopRubrosByBilling(invoices, 5)).toEqual([
      { name: "Embragues", amount: 500, invoiceCount: 2 },
      { name: "Filtros", amount: 400, invoiceCount: 1 },
    ]);
  });
});

describe("buildCollectionSlices", () => {
  it("separa cobrado y pendiente del mes", () => {
    const { slices, total } = buildCollectionSlices([
      invoice({
        id: "paid",
        totalVisualRounded: 800,
        outstandingAmount: 0,
        paymentStatus: "PAGA",
      }),
      invoice({
        id: "open",
        totalVisualRounded: 200,
        outstandingAmount: 200,
        paymentStatus: "IMPAGA",
      }),
    ]);

    expect(total).toBe(1000);
    expect(slices).toEqual([
      {
        key: "collected",
        label: "Cobrado",
        amount: 800,
        percent: 80,
        color: "#031b3d",
      },
      {
        key: "pending",
        label: "Pendiente",
        amount: 200,
        percent: 20,
        color: "#4a96dc",
      },
    ]);
  });
});

describe("listUnpaidInvoicesForDashboard", () => {
  it("ordena por saldo y arma el enlace con id", () => {
    const unpaid = listUnpaidInvoicesForDashboard([
      invoice({
        id: "small",
        invoiceNumber: "0007-PRUEBA-000000002",
        outstandingAmount: 50,
        paymentStatus: "IMPAGA",
      }),
      invoice({
        id: "big",
        invoiceNumber: "0007-PRUEBA-000000003",
        outstandingAmount: 400,
        paymentStatus: "IMPAGA",
        clientName: "Transportes",
      }),
    ]);

    expect(unpaid[0]).toMatchObject({
      id: "big",
      number: "0007-PRUEBA-000000003",
      clientName: "Transportes",
      total: 400,
    });
    expect(unpaid[0]?.dueLabel).toContain("Pendiente desde");
  });
});

describe("formatAmountTrend", () => {
  it("calcula variación porcentual contra el mes anterior", () => {
    expect(formatAmountTrend(118, 100, "agosto 2026")).toEqual({
      text: "↑ 18% vs. agosto 2026",
      isUp: true,
    });
    expect(formatAmountTrend(80, 100, "agosto 2026").isUp).toBe(false);
    expect(formatAmountTrend(50, 0, "agosto 2026").isUp).toBe(true);
  });
});

describe("buildBillingDashboardMetrics", () => {
  it("arma KPIs del mes, excluye anuladas y deja el saldo de todas las vigentes", () => {
    const metrics = buildBillingDashboardMetrics(
      [
        invoice({
          id: "sep-a",
          invoiceType: "A",
          totalVisualRounded: 1000,
          outstandingAmount: 0,
          paymentStatus: "PAGA",
          clientName: "Cliente A",
          items: [
            {
              id: "r1",
              rubroId: "frenos",
              rubroCode: "FRE",
              rubroName: "Frenos",
              description: "Juego",
              quantity: 1,
              unitPrice: 1000,
              lineTotal: 1000,
              sortOrder: 0,
            },
          ],
        }),
        invoice({
          id: "sep-open",
          invoiceType: "B",
          totalVisualRounded: 400,
          outstandingAmount: 400,
          paymentStatus: "IMPAGA",
          clientId: "client-2",
          clientName: "Cliente B",
        }),
        invoice({
          id: "aug",
          issuedAt: new Date("2026-08-10T12:00:00"),
          totalVisualRounded: 500,
          outstandingAmount: 0,
          paymentStatus: "PAGA",
        }),
        invoice({
          id: "void",
          fiscalStatus: "ANULADA_NC",
          totalVisualRounded: 9000,
          outstandingAmount: 0,
        }),
      ],
      new Date("2026-09-15T12:00:00"),
    );

    expect(metrics.billedAmount).toBe(1400);
    expect(metrics.invoiceCount).toBe(2);
    expect(metrics.outstandingAmount).toBe(400);
    expect(metrics.unpaidCount).toBe(1);
    expect(metrics.topRubros[0]).toEqual({
      name: "Frenos",
      amount: 1000,
      invoiceCount: 1,
    });
    expect(metrics.debtorClients).toEqual([
      {
        clientId: "client-2",
        name: "Cliente B",
        outstanding: 400,
        invoicesCount: 1,
        code: "",
        identification: null,
        whatsapp: null,
        email: null,
        lastPendingInvoiceNumber: null,
        lastPendingInvoiceDate: null,
      },
    ]);
    expect(metrics.unpaidKpi.value).toContain("400");
  });
});
