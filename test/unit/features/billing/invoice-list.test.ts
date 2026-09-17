import { describe, expect, it } from "vitest";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import {
  buildClientInvoiceSummaryMap,
  clientHasDebt,
  filterInvoiceList,
  invoiceMatchesDateRange,
  invoiceMatchesSearch,
  invoiceCanIssueReceipt,
  applyLiveClientNames,
  listDebtorClients,
  buildDebtorClients,
  filterDebtorClients,
  listTopClientsByBilling,
  parsePaymentStatusFilter,
  paymentStatusTone,
  prependBillingInvoiceInList,
} from "@/features/billing/utils/invoice-list";

function invoice(
  overrides: Partial<BillingInvoiceListItem> = {},
): BillingInvoiceListItem {
  const paymentStatus = overrides.paymentStatus ?? "PAGA";
  const totalVisualRounded = overrides.totalVisualRounded ?? 100;
  const paymentMethod =
    overrides.paymentMethod ??
    (paymentStatus === "PAGA" ? "CONTADO_EFECTIVO" : "CUENTA_CORRIENTE");

  return {
    id: "inv-1",
    environment: "MODO_PRUEBA",
    fiscalStatus: "MODO_PRUEBA",
    invoiceType: "B",
    pointOfSale: "0007",
    invoiceNumber: "0007-PRUEBA-000000001",
    issuedAt: new Date("2026-08-19T15:00:00"),
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
    createdAt: new Date("2026-08-19T15:00:00"),
    outstandingAmount:
      overrides.outstandingAmount ??
    (paymentStatus === "PAGA" || paymentStatus === "ANULADA"
      ? 0
      : totalVisualRounded),
    creditNoteCap: overrides.creditNoteCap ?? totalVisualRounded,
    receipts: [],
    billingNotes: [],
    printedAt: null,
    downloadedAt: null,
    sharedAt: null,
    ...overrides,
  };
}

describe("invoiceMatchesDateRange", () => {
  it("incluye facturas dentro del rango inclusive", () => {
    const item = invoice();

    expect(invoiceMatchesDateRange(item, "2026-08-19", "2026-08-19")).toBe(true);
    expect(invoiceMatchesDateRange(item, "2026-08-18", "2026-08-20")).toBe(true);
  });

  it("excluye facturas fuera del rango", () => {
    const item = invoice();

    expect(invoiceMatchesDateRange(item, "2026-08-20", "")).toBe(false);
    expect(invoiceMatchesDateRange(item, "", "2026-08-18")).toBe(false);
  });
});

describe("invoiceMatchesSearch", () => {
  it("encuentra por número, cliente, código o CUIT", () => {
    const item = invoice();

    expect(invoiceMatchesSearch(item, "PRUEBA-000000001")).toBe(true);
    expect(invoiceMatchesSearch(item, "méndez")).toBe(true);
    expect(invoiceMatchesSearch(item, "c-0001")).toBe(true);
    expect(invoiceMatchesSearch(item, "30-50001091-2")).toBe(true);
    expect(invoiceMatchesSearch(item, "30500010912")).toBe(true);
    expect(invoiceMatchesSearch(item, "inexistente")).toBe(false);
  });
});

describe("buildClientInvoiceSummaryMap", () => {
  it("agrupa montos y deuda por cliente vinculado", () => {
    const summaries = buildClientInvoiceSummaryMap([
      invoice({
        id: "a",
        paymentStatus: "PAGA",
        totalVisualRounded: 200,
      }),
      invoice({
        id: "b",
        paymentStatus: "IMPAGA",
        totalVisualRounded: 50,
      }),
      invoice({
        id: "c",
        clientId: "client-2",
        clientName: "Repuestos Norte",
        paymentStatus: "IMPAGA",
        totalVisualRounded: 80,
      }),
      invoice({
        id: "orphan",
        clientId: null,
        clientName: "Cliente borrado",
        paymentStatus: "IMPAGA",
        totalVisualRounded: 999,
      }),
    ]);

    expect(summaries.get("client-1")).toEqual({
      clientId: "client-1",
      clientName: "Taller Méndez",
      invoiceCount: 2,
      billedAmount: 250,
      unpaidCount: 1,
      unpaidAmount: 50,
    });
    expect(summaries.get("client-2")?.unpaidAmount).toBe(80);
    expect(summaries.has("orphan")).toBe(false);
    expect(clientHasDebt(summaries, "client-1")).toBe(true);
    expect(clientHasDebt(summaries, "client-missing")).toBe(false);
  });

  it("no cuenta como deuda el contado aunque quede marcado impago", () => {
    const summaries = buildClientInvoiceSummaryMap([
      invoice({
        id: "cash",
        paymentMethod: "CONTADO_EFECTIVO",
        paymentStatus: "IMPAGA",
        totalVisualRounded: 1089,
        outstandingAmount: 1089,
      }),
    ]);

    expect(summaries.get("client-1")).toMatchObject({
      billedAmount: 1089,
      unpaidCount: 0,
      unpaidAmount: 0,
    });
    expect(listDebtorClients(summaries.values())).toEqual([]);
  });

  it("cuenta el saldo de facturas parcialmente pagadas", () => {
    const summaries = buildClientInvoiceSummaryMap([
      invoice({
        id: "partial",
        paymentStatus: "PARCIALMENTE_PAGA",
        totalVisualRounded: 100,
        outstandingAmount: 40,
      }),
    ]);

    expect(summaries.get("client-1")).toMatchObject({
      unpaidCount: 1,
      unpaidAmount: 40,
    });
  });
});

describe("applyLiveClientNames", () => {
  it("usa el nombre actual del cliente y no el snapshot de la factura", () => {
    const summaries = buildClientInvoiceSummaryMap([
      invoice({
        clientId: "client-1",
        clientName: "MANUEL GOMEZ",
        paymentStatus: "PAGA",
        totalVisualRounded: 1089,
      }),
    ]);

    const live = applyLiveClientNames(summaries, [
      { id: "client-1", name: "MANUEL RODRIGUEZ" },
    ]);

    expect(live.get("client-1")?.clientName).toBe("MANUEL RODRIGUEZ");
    expect(listTopClientsByBilling(live.values())).toEqual([
      { name: "MANUEL RODRIGUEZ", amount: 1089, invoiceCount: 1 },
    ]);
  });
});

describe("invoiceCanIssueReceipt", () => {
  it("solo permite emitir en facturas de cuenta corriente con saldo", () => {
    expect(
      invoiceCanIssueReceipt(
        invoice({ paymentStatus: "IMPAGA", outstandingAmount: 100 }),
      ),
    ).toBe(true);
    expect(
      invoiceCanIssueReceipt(
        invoice({
          paymentStatus: "PARCIALMENTE_PAGA",
          outstandingAmount: 40,
        }),
      ),
    ).toBe(true);
    expect(
      invoiceCanIssueReceipt(
        invoice({ paymentStatus: "PAGA", outstandingAmount: 100 }),
      ),
    ).toBe(false);
    expect(
      invoiceCanIssueReceipt(
        invoice({
          paymentMethod: "CONTADO_EFECTIVO",
          paymentStatus: "IMPAGA",
          outstandingAmount: 100,
        }),
      ),
    ).toBe(false);
    expect(
      invoiceCanIssueReceipt(
        invoice({
          paymentStatus: "IMPAGA",
          outstandingAmount: 100,
          clientId: null,
        }),
      ),
    ).toBe(false);
  });
});

describe("paymentStatusTone", () => {
  it("mapea cada estado de pago", () => {
    expect(paymentStatusTone("PAGA")).toBe("ok");
    expect(paymentStatusTone("PARCIALMENTE_PAGA")).toBe("partial");
    expect(paymentStatusTone("IMPAGA")).toBe("inactive");
    expect(paymentStatusTone("ANULADA")).toBe("void");
  });
});

describe("listTopClientsByBilling y listDebtorClients", () => {
  it("ordena rankings y omite clientes al día en deuda", () => {
    const summaries = buildClientInvoiceSummaryMap([
      invoice({
        id: "paid",
        clientId: "client-paid",
        clientName: "Al día SA",
        paymentStatus: "PAGA",
        totalVisualRounded: 400,
      }),
      invoice({
        id: "debt",
        clientId: "client-debt",
        clientName: "Con deuda",
        paymentStatus: "IMPAGA",
        totalVisualRounded: 120,
      }),
    ]);

    expect(listTopClientsByBilling(summaries.values(), 5)).toEqual([
      { name: "Al día SA", amount: 400, invoiceCount: 1 },
      { name: "Con deuda", amount: 120, invoiceCount: 1 },
    ]);
    expect(listDebtorClients(summaries.values())).toEqual([
      {
        clientId: "client-debt",
        name: "Con deuda",
        outstanding: 120,
        invoicesCount: 1,
        code: "",
        identification: null,
        whatsapp: null,
        email: null,
        lastPendingInvoiceNumber: null,
        lastPendingInvoiceDate: null,
      },
    ]);
  });

  it("ordena por monto acumulado, no por cantidad de facturas", () => {
    const summaries = buildClientInvoiceSummaryMap([
      invoice({
        id: "small-1",
        clientId: "many",
        clientName: "Muchas facturas chicas",
        paymentStatus: "PAGA",
        totalVisualRounded: 90_000,
      }),
      invoice({
        id: "small-2",
        clientId: "many",
        clientName: "Muchas facturas chicas",
        paymentStatus: "PAGA",
        totalVisualRounded: 80_000,
      }),
      invoice({
        id: "big-1",
        clientId: "one",
        clientName: "Una factura grande",
        paymentStatus: "PAGA",
        totalVisualRounded: 10_000_000,
      }),
    ]);

    expect(listTopClientsByBilling(summaries.values(), 5)).toEqual([
      { name: "Una factura grande", amount: 10_000_000, invoiceCount: 1 },
      { name: "Muchas facturas chicas", amount: 170_000, invoiceCount: 2 },
    ]);
  });
});

describe("filterInvoiceList", () => {
  it("combina tipo, pago, fechas y búsqueda", () => {
    const invoices = [
      invoice({
        id: "a",
        invoiceType: "A",
        paymentStatus: "PAGA",
        invoiceNumber: "0007-PRUEBA-000000010",
      }),
      invoice({
        id: "b",
        invoiceType: "B",
        paymentStatus: "IMPAGA",
        invoiceNumber: "0007-PRUEBA-000000011",
        issuedAt: new Date("2026-07-01T12:00:00"),
      }),
      invoice({
        id: "c",
        invoiceType: "B",
        paymentStatus: "PARCIALMENTE_PAGA",
        invoiceNumber: "0007-PRUEBA-000000012",
        outstandingAmount: 25,
      }),
    ];

    expect(
      filterInvoiceList(invoices, {
        query: "",
        invoiceType: "A",
        paymentStatus: "all",
        fromDate: "",
        toDate: "",
      }).map((item) => item.id),
    ).toEqual(["a"]);

    expect(
      filterInvoiceList(invoices, {
        query: "000000011",
        invoiceType: "all",
        paymentStatus: "IMPAGA",
        fromDate: "2026-07-01",
        toDate: "2026-07-31",
      }).map((item) => item.id),
    ).toEqual(["b"]);

    expect(
      filterInvoiceList(invoices, {
        query: "",
        invoiceType: "all",
        paymentStatus: "PARCIALMENTE_PAGA",
        fromDate: "",
        toDate: "",
      }).map((item) => item.id),
    ).toEqual(["c"]);
  });

  it("filtra facturas anuladas por nota de crédito", () => {
    const invoices = [
      invoice({ id: "open", paymentStatus: "IMPAGA", outstandingAmount: 100 }),
      invoice({
        id: "voided",
        paymentStatus: "ANULADA",
        fiscalStatus: "ANULADA_NC",
      }),
    ];

    expect(
      filterInvoiceList(invoices, {
        query: "",
        invoiceType: "all",
        paymentStatus: "ANULADA",
        fromDate: "",
        toDate: "",
      }).map((item) => item.id),
    ).toEqual(["voided"]);
  });
});

describe("parsePaymentStatusFilter", () => {
  it("acepta estados de pago válidos y descarta el resto", () => {
    expect(parsePaymentStatusFilter("IMPAGA")).toBe("IMPAGA");
    expect(parsePaymentStatusFilter("PARCIALMENTE_PAGA")).toBe(
      "PARCIALMENTE_PAGA",
    );
    expect(parsePaymentStatusFilter("PAGA")).toBe("PAGA");
    expect(parsePaymentStatusFilter("ANULADA")).toBe("ANULADA");
    expect(parsePaymentStatusFilter("all")).toBe("all");
    expect(parsePaymentStatusFilter("nope")).toBe("all");
    expect(parsePaymentStatusFilter(undefined)).toBe("all");
  });
});

describe("buildDebtorClients", () => {
  it("agrupa saldos de cuenta corriente y conserva el último comprobante pendiente", () => {
    const debtors = buildDebtorClients([
      invoice({
        id: "old",
        invoiceNumber: "0007-PRUEBA-000000001",
        issuedAt: new Date("2026-08-01T12:00:00"),
        paymentStatus: "IMPAGA",
        outstandingAmount: 100,
        clientCode: "C-0001",
        clientWhatsapp: "3624000000",
        clientEmail: "deuda@mail.com",
      }),
      invoice({
        id: "new",
        invoiceNumber: "0007-PRUEBA-000000009",
        issuedAt: new Date("2026-08-20T12:00:00"),
        paymentStatus: "PARCIALMENTE_PAGA",
        outstandingAmount: 50,
        clientCode: "C-0001",
      }),
      invoice({
        id: "cash",
        paymentMethod: "CONTADO",
        paymentStatus: "IMPAGA",
        outstandingAmount: 80,
      }),
    ]);

    expect(debtors).toHaveLength(1);
    expect(debtors[0]).toMatchObject({
      clientId: "client-1",
      outstanding: 150,
      invoicesCount: 2,
      lastPendingInvoiceNumber: "0007-PRUEBA-000000009",
      code: "C-0001",
    });
    expect(
      filterDebtorClients(debtors, "C-0001", "asc")[0]?.outstanding,
    ).toBe(150);
  });
});

describe("prependBillingInvoiceInList", () => {
  it("coloca la factura nueva al inicio", () => {
    const existing = invoice({ id: "old", invoiceNumber: "0007-PRUEBA-000000001" });
    const created = invoice({ id: "new", invoiceNumber: "0007-PRUEBA-000000026" });

    expect(prependBillingInvoiceInList([existing], created)).toEqual([
      created,
      existing,
    ]);
  });

  it("no duplica si la factura ya está en la lista", () => {
    const created = invoice({ id: "new" });

    expect(prependBillingInvoiceInList([created], created)).toEqual([created]);
  });

  it("no inventa una lista de una sola factura si el cache está vacío", () => {
    expect(prependBillingInvoiceInList(undefined, invoice({ id: "new" }))).toBeUndefined();
  });
});
