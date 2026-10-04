import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import { buildLibroIvaPdf } from "@/server/pdf/build-libro-iva-pdf";
import { buildLibroIvaXlsx } from "@/server/excel/build-libro-iva-xlsx";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import { billingInvoiceRepository } from "@/server/repositories/billing-invoice.repository";
import { billingNoteRepository } from "@/server/repositories/billing-note.repository";
import { billingLibroIvaService } from "@/server/services/billing-libro-iva.service";
import { adminUserFixture, mockRequireRole } from "../../../helpers/mocks/auth";

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
    getOrCreate: vi.fn(),
  },
}));
vi.mock("@/server/repositories/billing-invoice.repository", () => ({
  billingInvoiceRepository: {
    findIssuedBetween: vi.fn(),
  },
}));
vi.mock("@/server/repositories/billing-note.repository", () => ({
  billingNoteRepository: {
    findIssuedBetween: vi.fn(),
  },
}));
vi.mock("@/server/pdf/build-libro-iva-pdf", () => ({
  buildLibroIvaPdf: vi.fn(async () => new Uint8Array([1])),
  buildLibroIvaDailyPdf: vi.fn(async () => new Uint8Array([1])),
}));
vi.mock("@/server/excel/build-libro-iva-xlsx", () => ({
  buildLibroIvaXlsx: vi.fn(async () => new Uint8Array([1])),
  buildLibroIvaDailyXlsx: vi.fn(async () => new Uint8Array([1])),
}));

const ISSUED_AT = new Date(2026, 9, 2);

function money(value: number) {
  return { toNumber: () => value };
}

function invoice(environment: BillingFiscalEnvironment, invoiceNumber: string) {
  return {
    environment,
    issuedAt: ISSUED_AT,
    invoiceType: "B" as const,
    pointOfSale: "0007",
    invoiceNumber,
    clientName: "Cliente",
    clientIdentificationType: "CUIT" as const,
    clientIdentificationNumber: "30712345671",
    clientIvaCondition: "RESPONSABLE_INSCRIPTO" as const,
    subtotal: money(1000),
    discountAmount: money(0),
    ivaPercent: money(21),
    ivaAmount: money(210),
    total: money(1210),
    totalVisualRounded: money(1210),
  };
}

function note(
  environment: BillingFiscalEnvironment,
  noteNumber: string,
  fiscalStatus: "INTERNA" | "AUTORIZADA",
  overrides: {
    kind?: "CREDIT" | "DEBIT";
    netAmount?: number;
    ivaAmount?: number;
    amount?: number;
    voucherType?: number;
    sequenceNumber?: number;
  } = {},
) {
  return {
    environment,
    fiscalStatus,
    kind: overrides.kind ?? "CREDIT",
    issuedAt: ISSUED_AT,
    invoiceType: "A" as const,
    pointOfSale: "0007",
    sequenceNumber: overrides.sequenceNumber ?? 1,
    voucherType: overrides.voucherType ?? (overrides.kind === "DEBIT" ? 2 : 3),
    cae: fiscalStatus === "AUTORIZADA" ? "71234567890123" : null,
    noteNumber,
    clientName: "Cliente",
    clientIdentificationType: "CUIT" as const,
    clientIdentificationNumber: "30712345671",
    clientIvaCondition: "RESPONSABLE_INSCRIPTO" as const,
    netAmount: money(overrides.netAmount ?? 100),
    ivaPercent: money(21),
    ivaAmount: money(overrides.ivaAmount ?? 21),
    amount: money(overrides.amount ?? 121),
    invoice: { invoiceNumber: "0007-00000001", totalVisualRounded: money(9999) },
  };
}

const invoices = [
  invoice("MODO_PRUEBA", "0007-PRUEBA-000000001"),
  invoice("HOMOLOGACION", "0007-00000003"),
  invoice("PRODUCCION", "0007-00000001"),
];

const notes = [
  note("MODO_PRUEBA", "0007-PRUEBA-NC-000000001", "INTERNA"),
  note("HOMOLOGACION", "0007-PRUEBA-NC-000000002", "INTERNA"),
  note("HOMOLOGACION", "0007-00000011", "AUTORIZADA", {
    sequenceNumber: 11,
    netAmount: 200,
    ivaAmount: 42,
    amount: 242,
  }),
  note("PRODUCCION", "0007-PRUEBA-NC-000000003", "INTERNA"),
  note("PRODUCCION", "0007-00000004", "AUTORIZADA", { sequenceNumber: 4 }),
  note("PRODUCCION", "0007-00000005", "AUTORIZADA", {
    kind: "DEBIT",
    voucherType: 2,
    sequenceNumber: 5,
    netAmount: 50,
    ivaAmount: 10.5,
    amount: 60.5,
  }),
];

function filterByEnvironment<T extends { environment: BillingFiscalEnvironment }>(
  rows: T[],
  environment: BillingFiscalEnvironment | undefined,
) {
  if (!environment) {
    return rows;
  }

  return rows.filter((row) => row.environment === environment);
}

describe("BillingLibroIvaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue({
      environment: "PRODUCCION",
      pointOfSale: "0007",
      ivaPercent: money(21),
      issuerName: null,
      issuerCuit: null,
      issuerAddress: null,
      issuerCity: null,
      issuerProvince: null,
      issuerIvaCondition: null,
      issuerGrossIncome: null,
      issuerActivitiesStartedAt: null,
    } as never);
    vi.mocked(billingInvoiceRepository.findIssuedBetween).mockImplementation(
      async (_from, _to, environment) =>
        filterByEnvironment(invoices, environment) as never,
    );
    vi.mocked(billingNoteRepository.findIssuedBetween).mockImplementation(
      async (_from, _to, environment) =>
        filterByEnvironment(notes, environment) as never,
    );
  });

  it("PDF y XLSX incluyen solo el ambiente fiscal vigente", async () => {
    await billingLibroIvaService.generatePdf(2026, 10);
    await billingLibroIvaService.generateXlsx(2026, 10);

    const pdfRows = vi.mocked(buildLibroIvaPdf).mock.calls[0]?.[0].rows ?? [];
    const xlsxRows = vi.mocked(buildLibroIvaXlsx).mock.calls[0]?.[0].rows ?? [];

    expect(pdfRows.map((row) => row.number)).toEqual([
      "0007-00000001",
      "0007-00000004",
      "0007-00000005",
    ]);
    const credit = pdfRows.find((row) => row.number === "0007-00000004");
    const debit = pdfRows.find((row) => row.number === "0007-00000005");
    expect(credit).toMatchObject({ netAmount: -100, ivaAmount: -21, total: -121 });
    expect(debit).toMatchObject({ netAmount: 50, ivaAmount: 10.5, total: 60.5 });
    expect(credit?.total).not.toBe(9999);
    expect(pdfRows.map((row) => row.number)).not.toContain("0007-PRUEBA-NC-000000003");
    expect(xlsxRows.map((row) => row.number)).toEqual(
      pdfRows.map((row) => row.number),
    );
    expect(pdfRows.map((row) => row.number).join(" ")).not.toContain("PRUEBA-000000001");
    expect(pdfRows.map((row) => row.number)).not.toContain("0007-00000003");
    expect(
      vi.mocked(billingInvoiceRepository.findIssuedBetween),
    ).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), "PRODUCCION");
    expect(
      vi.mocked(billingNoteRepository.findIssuedBetween),
    ).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), "PRODUCCION");
  });

  it("homologación excluye internas y modo prueba conserva las internas", async () => {
    vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue({
      environment: "HOMOLOGACION",
      pointOfSale: "0007",
      ivaPercent: money(21),
    } as never);
    await billingLibroIvaService.generatePdf(2026, 10);
    const homologation = vi.mocked(buildLibroIvaPdf).mock.calls.at(-1)?.[0].rows ?? [];

    expect(homologation.map((row) => row.number)).toEqual([
      "0007-00000003",
      "0007-00000011",
    ]);
    expect(homologation.map((row) => row.number)).not.toContain(
      "0007-PRUEBA-NC-000000002",
    );
    expect(homologation.map((row) => row.number)).not.toContain("0007-00000004");

    vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue({
      environment: "MODO_PRUEBA",
      pointOfSale: "0007",
      ivaPercent: money(21),
    } as never);
    await billingLibroIvaService.generatePdf(2026, 10);
    await billingLibroIvaService.generateXlsx(2026, 10);
    const pdfRows = vi.mocked(buildLibroIvaPdf).mock.calls.at(-1)?.[0].rows ?? [];
    const xlsxRows = vi.mocked(buildLibroIvaXlsx).mock.calls.at(-1)?.[0].rows ?? [];

    expect(pdfRows.map((row) => row.number)).toEqual([
      "0007-PRUEBA-000000001",
      "0007-PRUEBA-NC-000000001",
    ]);
    expect(xlsxRows.map((row) => row.number)).toEqual(pdfRows.map((row) => row.number));
    expect(pdfRows.map((row) => row.number)).not.toContain("0007-00000004");
  });
});
