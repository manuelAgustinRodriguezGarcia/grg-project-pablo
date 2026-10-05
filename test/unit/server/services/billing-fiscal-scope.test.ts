import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import { toBillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import { toBillingNoteListItem } from "@/features/billing/types/billing-note.types";
import { toBillingReceiptListItem } from "@/features/billing/types/billing-receipt.types";
import { buildBillingDashboardMetrics } from "@/features/billing/utils/billing-metrics";
import {
  buildClientInvoiceSummaryMap,
  buildDebtorClients,
} from "@/features/billing/utils/invoice-list";
import { buildBillingMovements } from "@/features/billing/utils/movement-list";
import { buildDebtorsXlsx } from "@/server/excel/build-debtors-xlsx";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import { billingInvoiceRepository } from "@/server/repositories/billing-invoice.repository";
import { billingNoteRepository } from "@/server/repositories/billing-note.repository";
import { billingReceiptRepository } from "@/server/repositories/billing-receipt.repository";
import { billingDebtorsService } from "@/server/services/billing-debtors.service";
import { billingInvoiceService } from "@/server/services/billing-invoice.service";
import { billingNoteService } from "@/server/services/billing-note.service";
import { billingReceiptService } from "@/server/services/billing-receipt.service";
import { adminUserFixture, mockRequirePermission } from "../../../helpers/mocks/auth";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
  requireEditor: vi.fn(),
  requirePermission: vi.fn(),
  requireAnyPermission: vi.fn(),
}));
vi.mock("@/server/repositories/billing-fiscal-settings.repository", () => ({
  billingFiscalSettingsRepository: {
    readEnvironment: vi.fn(),
    getOrCreate: vi.fn(),
  },
}));
vi.mock("@/server/repositories/billing-invoice.repository", () => ({
  billingInvoiceRepository: {
    findAllOrdered: vi.fn(),
    findById: vi.fn(),
  },
}));
vi.mock("@/server/repositories/billing-note.repository", () => ({
  billingNoteRepository: {
    findAllOrdered: vi.fn(),
    findById: vi.fn(),
  },
}));
vi.mock("@/server/repositories/billing-receipt.repository", () => ({
  billingReceiptRepository: {
    findAllOrdered: vi.fn(),
    findById: vi.fn(),
  },
}));
vi.mock("@/server/database/prisma", () => ({
  prisma: {},
}));
vi.mock("@/server/excel/build-debtors-xlsx", () => ({
  buildDebtorsXlsx: vi.fn(async () => new Uint8Array([1])),
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: { logOperationSafe: vi.fn() },
}));
vi.mock("@/server/services/billing-invoice-settlement", () => ({
  releaseOverpaymentsForClient: vi.fn(),
  syncInvoiceSettlement: vi.fn(),
  loadInvoiceSettlementSums: vi.fn(),
}));
vi.mock("@/server/arca/invoices/issue-arca-invoice", () => ({
  issueArcaInvoice: vi.fn(),
}));
vi.mock("@/server/arca/invoices/finalize-approved-arca-emission", () => ({
  finalizeApprovedArcaEmission: vi.fn(),
}));
vi.mock("@/server/arca/repositories/arca-emission.repository", () => ({
  arcaEmissionRepository: { findByIdempotencyKey: vi.fn(), findByNoteId: vi.fn() },
}));
vi.mock("@/server/pdf/build-invoice-pdf", () => ({ buildInvoicePdf: vi.fn() }));
vi.mock("@/server/pdf/build-note-pdf", () => ({ buildNotePdf: vi.fn() }));
vi.mock("@/server/pdf/build-receipt-pdf", () => ({ buildReceiptPdf: vi.fn() }));
vi.mock("@/server/pdf/load-rothamel-logo", () => ({
  loadRothamelLogoPng: vi.fn(),
}));

const NOW = new Date(2026, 9, 4, 12, 0, 0);
const CLIENT_ID = "client-shared";

function money(value: number) {
  return { toNumber: () => value };
}

function invoiceRow(input: {
  id: string;
  environment: BillingFiscalEnvironment;
  total: number;
  invoiceType?: "A" | "B";
  paymentMethod?: "CONTADO" | "CUENTA_CORRIENTE";
  billingNotes?: Array<{
    kind: "CREDIT" | "DEBIT";
    environment: BillingFiscalEnvironment;
    amount: number;
  }>;
}) {
  const paymentMethod = input.paymentMethod ?? "CONTADO";

  return {
    id: input.id,
    environment: input.environment,
    fiscalStatus: input.environment === "MODO_PRUEBA" ? "MODO_PRUEBA" : "AUTORIZADA",
    invoiceType: input.invoiceType ?? "B",
    pointOfSale: "0007",
    sequenceNumber: 1,
    invoiceNumber: input.id,
    issuedAt: new Date("2026-10-02T15:00:00.000Z"),
    clientId: CLIENT_ID,
    clientCode: "C-0001",
    clientName: "Cliente Compartido",
    clientAddress: null,
    clientCity: null,
    clientProvince: null,
    clientEmail: null,
    clientWhatsapp: null,
    clientIdentificationType: "CUIT" as const,
    clientIdentificationNumber: "30500010912",
    clientIvaCondition: "RESPONSABLE_INSCRIPTO" as const,
    subtotal: money(input.total),
    discountPercent: money(0),
    discountAmount: money(0),
    ivaPercent: money(21),
    ivaAmount: money(0),
    total: money(input.total),
    totalVisualRounded: money(input.total),
    paymentMethod,
    paymentStatus: paymentMethod === "CUENTA_CORRIENTE" ? "IMPAGA" : "PAGA",
    notes: null,
    cae: null,
    caeExpiresAt: null,
    qrUrl: null,
    pdfPath: null,
    printedAt: null,
    downloadedAt: null,
    sharedAt: null,
    createdAt: new Date("2026-10-02T15:00:00.000Z"),
    updatedAt: new Date("2026-10-02T15:00:00.000Z"),
    items: [],
    allocations: [],
    billingNotes: (input.billingNotes ?? []).map((note) => ({
      kind: note.kind,
      environment: note.environment,
      amount: money(note.amount),
    })),
  };
}

const cashInvoices = [
  invoiceRow({
    id: "prod",
    environment: "PRODUCCION",
    total: 10000,
    invoiceType: "A",
  }),
  invoiceRow({
    id: "homo",
    environment: "HOMOLOGACION",
    total: 1210,
    invoiceType: "B",
  }),
  invoiceRow({
    id: "prueba",
    environment: "MODO_PRUEBA",
    total: 500,
    invoiceType: "B",
  }),
];

const accountInvoices = [
  invoiceRow({
    id: "prod-cc",
    environment: "PRODUCCION",
    total: 1000,
    invoiceType: "A",
    paymentMethod: "CUENTA_CORRIENTE",
    billingNotes: [
      { kind: "CREDIT", environment: "HOMOLOGACION", amount: 200 },
    ],
  }),
  invoiceRow({
    id: "homo-cc",
    environment: "HOMOLOGACION",
    total: 1210,
    invoiceType: "B",
    paymentMethod: "CUENTA_CORRIENTE",
  }),
];

function noteRow(environment: BillingFiscalEnvironment, amount: number) {
  return {
    id: `note-${environment}`,
    kind: "CREDIT" as const,
    fiscalStatus: environment === "MODO_PRUEBA" ? "INTERNA" : "AUTORIZADA",
    environment,
    noteNumber: `NC-${environment}`,
    issuedAt: new Date("2026-10-02T15:00:00.000Z"),
    invoiceId: environment,
    invoiceType: "B" as const,
    amount: money(amount),
    netAmount: money(amount),
    ivaAmount: money(0),
    reason: "Ajuste",
    clientId: CLIENT_ID,
    clientName: "Cliente Compartido",
    clientCode: "C-0001",
    clientIdentificationType: "CUIT" as const,
    clientIdentificationNumber: "30500010912",
    clientIvaCondition: "RESPONSABLE_INSCRIPTO" as const,
    createdBy: { name: "Admin" },
    invoice: { invoiceNumber: environment },
    printedAt: null,
    downloadedAt: null,
    sharedAt: null,
  };
}

function receiptRow(
  id: string,
  environments: BillingFiscalEnvironment[],
) {
  return {
    id,
    receiptNumber: id,
    issuedAt: new Date("2026-10-02T15:00:00.000Z"),
    amount: money(100),
    paymentMethod: "EFECTIVO" as const,
    notes: null,
    clientId: CLIENT_ID,
    createdBy: { name: "Admin" },
    client: {
      id: CLIENT_ID,
      name: "Cliente Compartido",
      email: null,
      whatsapp: null,
    },
    allocations: environments.map((environment) => ({
      amount: money(50),
      invoice: {
        id: environment,
        invoiceNumber: environment,
        invoiceType: "B" as const,
        environment,
      },
    })),
    printedAt: null,
    downloadedAt: null,
    sharedAt: null,
  };
}

async function visibleInvoices(environment: BillingFiscalEnvironment) {
  vi.mocked(billingFiscalSettingsRepository.readEnvironment).mockResolvedValue(
    environment,
  );
  const rows = await billingInvoiceService.listInvoices();
  return rows.map((row) => toBillingInvoiceListItem(row as never));
}

describe("aislamiento por ambiente fiscal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission(adminUserFixture);
    vi.mocked(billingInvoiceRepository.findAllOrdered).mockImplementation(
      async () => cashInvoices as never,
    );
    vi.mocked(billingNoteRepository.findAllOrdered).mockImplementation(
      async () =>
        [
          noteRow("PRODUCCION", 300),
          noteRow("HOMOLOGACION", 1210),
          noteRow("MODO_PRUEBA", 40),
        ] as never,
    );
    vi.mocked(billingReceiptRepository.findAllOrdered).mockImplementation(
      async () =>
        [
          receiptRow("receipt-prod", ["PRODUCCION"]),
          receiptRow("receipt-homo", ["HOMOLOGACION"]),
          receiptRow("receipt-mixed", ["PRODUCCION", "HOMOLOGACION"]),
        ] as never,
    );
  });

  it.each([
    ["PRODUCCION", ["prod"]],
    ["HOMOLOGACION", ["homo"]],
    ["MODO_PRUEBA", ["prueba"]],
  ] as const)(
    "el listado de facturas en %s muestra solo ese ambiente",
    async (environment, ids) => {
      vi.mocked(billingFiscalSettingsRepository.readEnvironment).mockResolvedValue(
        environment,
      );

      const invoices = await billingInvoiceService.listInvoices();

      expect(billingInvoiceRepository.findAllOrdered).toHaveBeenCalledWith(
        environment,
      );
      expect(invoices.map((invoice) => invoice.id)).toEqual(ids);
    },
  );

  it("el dashboard con PRODUCCION activo suma exactamente 10000 y el mix A/B no toma otros ambientes", async () => {
    const invoices = await visibleInvoices("PRODUCCION");
    const metrics = buildBillingDashboardMetrics(invoices, NOW);

    expect(metrics.billedAmount).toBe(10000);
    expect(metrics.invoiceTypeSlices).toEqual([
      expect.objectContaining({ key: "a", amount: 10000, invoiceCount: 1 }),
      expect.objectContaining({ key: "b", amount: 0, invoiceCount: 0 }),
    ]);
  });

  it("el dashboard con HOMOLOGACION activo suma 1210", async () => {
    const invoices = await visibleInvoices("HOMOLOGACION");
    const metrics = buildBillingDashboardMetrics(invoices, NOW);

    expect(metrics.billedAmount).toBe(1210);
  });

  it("el dashboard con MODO_PRUEBA activo suma 500", async () => {
    const invoices = await visibleInvoices("MODO_PRUEBA");
    const metrics = buildBillingDashboardMetrics(invoices, NOW);

    expect(metrics.billedAmount).toBe(500);
  });

  it("deudores y el historial del cliente ignoran la cuenta corriente de otro ambiente", async () => {
    vi.mocked(billingInvoiceRepository.findAllOrdered).mockImplementation(
      async () => accountInvoices as never,
    );
    vi.mocked(billingFiscalSettingsRepository.readEnvironment).mockResolvedValue(
      "PRODUCCION",
    );

    const invoices = (await billingInvoiceService.listInvoices()).map((row) =>
      toBillingInvoiceListItem(row as never),
    );
    const debtors = buildDebtorClients(invoices);
    const summary = buildClientInvoiceSummaryMap(invoices).get(CLIENT_ID);

    expect(debtors).toEqual([
      expect.objectContaining({
        clientId: CLIENT_ID,
        outstanding: 1000,
        invoicesCount: 1,
      }),
    ]);
    expect(summary).toEqual(
      expect.objectContaining({
        billedAmount: 1000,
        unpaidAmount: 1000,
        invoiceCount: 1,
      }),
    );
    expect(invoices[0]?.billingNotes).toEqual([]);
  });

  it("el excel de deudores pide facturas del ambiente vigente", async () => {
    vi.mocked(billingInvoiceRepository.findAllOrdered).mockImplementation(
      async () => accountInvoices as never,
    );
    vi.mocked(billingFiscalSettingsRepository.readEnvironment).mockResolvedValue(
      "PRODUCCION",
    );

    await billingDebtorsService.generateXlsx({
      query: "",
      fromDate: "",
      toDate: "",
      sort: "desc",
    });

    expect(billingInvoiceRepository.findAllOrdered).toHaveBeenCalledWith(
      "PRODUCCION",
    );
    expect(buildDebtorsXlsx).toHaveBeenCalledWith([
      expect.objectContaining({ outstanding: 1000, invoicesCount: 1 }),
    ]);
  });

  it("movimientos de notas y recibos quedan en el ambiente vigente", async () => {
    vi.mocked(billingFiscalSettingsRepository.readEnvironment).mockResolvedValue(
      "HOMOLOGACION",
    );

    const notes = (await billingNoteService.listNotes()).map((note) =>
      toBillingNoteListItem(note),
    );
    const receipts = (await billingReceiptService.listReceipts()).map((receipt) =>
      toBillingReceiptListItem(receipt as never),
    );
    const movements = buildBillingMovements(receipts, notes);

    expect(billingNoteRepository.findAllOrdered).toHaveBeenCalledWith(
      "HOMOLOGACION",
    );
    expect(billingReceiptRepository.findAllOrdered).toHaveBeenCalledWith(
      "HOMOLOGACION",
    );
    expect(movements.map((movement) => movement.number).sort()).toEqual([
      "NC-HOMOLOGACION",
      "receipt-homo",
    ]);
  });

  it("una factura de otro ambiente no se abre por id", async () => {
    vi.mocked(billingFiscalSettingsRepository.readEnvironment).mockResolvedValue(
      "PRODUCCION",
    );
    vi.mocked(billingInvoiceRepository.findById).mockResolvedValue(
      invoiceRow({
        id: "homo",
        environment: "HOMOLOGACION",
        total: 1210,
      }) as never,
    );

    await expect(billingInvoiceService.getInvoice("homo")).rejects.toMatchObject({
      code: "BILLING_INVOICE_NOT_FOUND",
    });
  });
});
