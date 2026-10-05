import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  LEGACY_NOTE_INVOICE_ENVIRONMENT_MESSAGE,
  LEGACY_NOTES_DISABLED_MESSAGE,
} from "@/features/billing/utils/legacy-notes";
import { arcaEmissionRepository } from "@/server/arca/repositories/arca-emission.repository";
import { prisma } from "@/server/database/prisma";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import { billingInvoiceRepository } from "@/server/repositories/billing-invoice.repository";
import { billingNoteRepository } from "@/server/repositories/billing-note.repository";
import { buildNotePdf } from "@/server/pdf/build-note-pdf";
import { loadRothamelLogoPng } from "@/server/pdf/load-rothamel-logo";
import { billingNoteService } from "@/server/services/billing-note.service";
import {
  loadInvoiceSettlementSums,
  syncInvoiceSettlement,
} from "@/server/services/billing-invoice-settlement";
import { adminUserFixture, mockRequireRole } from "../../../helpers/mocks/auth";

const billingNoteCreate = vi.hoisted(() => vi.fn());

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
    readEnvironment: vi.fn(),
  },
}));
vi.mock("@/server/repositories/billing-invoice.repository", () => ({
  billingInvoiceRepository: {
    findById: vi.fn(),
  },
}));
vi.mock("@/server/repositories/billing-note.repository", () => ({
  billingNoteRepository: {
    findById: vi.fn(),
    getNextSequenceNumber: vi.fn(),
    isUniqueConstraintError: vi.fn(),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperationSafe: vi.fn(),
  },
}));
vi.mock("@/server/services/billing-invoice-settlement", () => ({
  loadInvoiceSettlementSums: vi.fn(),
  syncInvoiceSettlement: vi.fn(),
}));
vi.mock("@/server/database/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));
vi.mock("@/server/pdf/build-note-pdf", () => ({
  buildNotePdf: vi.fn(),
}));
vi.mock("@/server/arca/repositories/arca-emission.repository", () => ({
  arcaEmissionRepository: {
    findByNoteId: vi.fn(),
  },
}));
vi.mock("@/server/pdf/load-rothamel-logo", () => ({
  loadRothamelLogoPng: vi.fn(),
}));

function money(value: number) {
  return new Prisma.Decimal(value);
}

function settings(environment: "MODO_PRUEBA" | "HOMOLOGACION" | "PRODUCCION") {
  return {
    environment,
    pointOfSale: "0007",
  };
}

function mockInvoice(environment: "MODO_PRUEBA" | "HOMOLOGACION" | "PRODUCCION") {
  vi.mocked(billingInvoiceRepository.findById).mockResolvedValue({
    id: "invoice-1",
    environment,
    fiscalStatus: environment === "MODO_PRUEBA" ? "MODO_PRUEBA" : "AUTORIZADA",
    invoiceType: "B",
    clientId: "client-1",
    clientCode: "GOMEZ-0001",
    clientName: "GOMEZ SRL",
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: "30712345671",
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    paymentMethod: "CUENTA_CORRIENTE",
    paymentStatus: "IMPAGA",
    ivaPercent: money(21),
    totalVisualRounded: money(1210),
  } as never);
}

describe("BillingNoteService.createNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    billingNoteCreate.mockResolvedValue({ id: "note-1" });
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return callback({
        billingNote: { create: billingNoteCreate },
      } as never);
    });
    mockInvoice("MODO_PRUEBA");
    vi.mocked(billingNoteRepository.getNextSequenceNumber).mockResolvedValue(1);
    vi.mocked(billingNoteRepository.isUniqueConstraintError).mockReturnValue(
      false,
    );
    vi.mocked(loadInvoiceSettlementSums).mockResolvedValue({
      allocatedCents: 0,
      creditCents: 0,
      debitCents: 0,
    });
    vi.mocked(syncInvoiceSettlement).mockResolvedValue({
      paymentStatus: "IMPAGA",
      fiscalStatus: "AJUSTADA_NC",
      outstandingCents: 0,
      creditCapCents: 0,
    });
    vi.mocked(billingNoteRepository.findById).mockResolvedValue({
      id: "note-1",
    } as never);
  });

  it("en modo prueba crea la nota interna sobre una factura de modo prueba", async () => {
    vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
      settings("MODO_PRUEBA") as never,
    );
    mockInvoice("MODO_PRUEBA");

    const note = await billingNoteService.createNote({
      kind: "CREDIT",
      invoiceId: "invoice-1",
      amount: 121,
      reason: "Ajuste",
    });

    expect(note.id).toBe("note-1");
    expect(billingNoteCreate).toHaveBeenCalledTimes(1);
    expect(billingNoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          environment: "MODO_PRUEBA",
          kind: "CREDIT",
          fiscalStatus: "INTERNA",
          voucherType: null,
          cae: null,
          caeExpiresAt: null,
          qrUrl: null,
        }),
      }),
    );
  });

  it.each(["HOMOLOGACION", "PRODUCCION"] as const)(
    "en %s bloquea la nota interna antes de persistirla",
    async (environment) => {
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        settings(environment) as never,
      );

      await expect(
        billingNoteService.createNote({
          kind: "CREDIT",
          invoiceId: "invoice-1",
          amount: 121,
          reason: "Ajuste",
        }),
      ).rejects.toMatchObject({
        code: "LEGACY_NOTES_DISABLED",
        message: LEGACY_NOTES_DISABLED_MESSAGE,
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(billingNoteCreate).not.toHaveBeenCalled();
      expect(billingInvoiceRepository.findById).not.toHaveBeenCalled();
    },
  );

  it.each(["PRODUCCION", "HOMOLOGACION"] as const)(
    "en modo prueba rechaza una nota interna sobre una factura %s autorizada",
    async (environment) => {
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        settings("MODO_PRUEBA") as never,
      );
      mockInvoice(environment);

      await expect(
        billingNoteService.createNote({
          kind: "CREDIT",
          invoiceId: "invoice-1",
          amount: 121,
          reason: "Ajuste",
        }),
      ).rejects.toMatchObject({
        code: "LEGACY_NOTE_INVOICE_ENVIRONMENT",
        message: LEGACY_NOTE_INVOICE_ENVIRONMENT_MESSAGE,
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(billingNoteCreate).not.toHaveBeenCalled();
      expect(syncInvoiceSettlement).not.toHaveBeenCalled();
      expect(loadInvoiceSettlementSums).not.toHaveBeenCalled();
    },
  );

  function authorizedNote() {
    vi.mocked(billingNoteRepository.findById).mockResolvedValue({
      id: "note-1",
      kind: "CREDIT",
      noteNumber: "0007-00000012",
      invoiceType: "A",
      environment: "PRODUCCION",
      fiscalStatus: "AUTORIZADA",
      pointOfSale: "0007",
      sequenceNumber: 12,
      voucherType: 3,
      cae: "71234567890123",
      caeExpiresAt: new Date(Date.UTC(2026, 9, 11)),
      issuedAt: new Date("2026-10-03T15:00:00.000Z"),
      amount: { toNumber: () => 200 },
      netAmount: { toNumber: () => 165.29 },
      ivaAmount: { toNumber: () => 34.71 },
      ivaPercent: { toNumber: () => 21 },
      reason: "Ajuste",
      clientName: "CLIENTE SNAPSHOT SA",
      clientCode: "CLI-0009",
      clientIdentificationType: "CUIT",
      clientIdentificationNumber: "30500010912",
      clientIvaCondition: "RESPONSABLE_INSCRIPTO",
      createdBy: { name: "Admin" },
      invoice: {
        invoiceNumber: "0007-00000009",
        issuedAt: new Date(2026, 8, 30),
      },
    } as never);
  }

  it("el PDF autorizado usa el emisor de la emisión y no la configuración vigente", async () => {
    vi.mocked(loadRothamelLogoPng).mockResolvedValue(null);
    vi.mocked(buildNotePdf).mockResolvedValue(new Uint8Array([1]));
    vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue({
      environment: "PRODUCCION",
      issuerName: "ROTHAMEL NUEVO",
      issuerCuit: "30712345671",
      issuerAddress: "DOMICILIO NUEVO",
    } as never);
    authorizedNote();
    vi.mocked(arcaEmissionRepository.findByNoteId).mockResolvedValue({
      billingPayloadSnapshot: {
        documentKind: "NOTE",
        issuerSnapshot: {
          name: "ROTHAMEL ORIGINAL",
          cuit: "30712345671",
          address: "DOMICILIO ORIGINAL",
          city: "Rosario",
          province: "Santa Fe",
          ivaCondition: "Responsable Inscripto",
          grossIncome: "123",
          activitiesStartedAt: "2020-01-01",
        },
      },
    } as never);

    vi.mocked(billingFiscalSettingsRepository.readEnvironment).mockResolvedValue(
      "PRODUCCION",
    );

    await billingNoteService.generateNotePdf("note-1");

    expect(billingFiscalSettingsRepository.getOrCreate).not.toHaveBeenCalled();
    expect(vi.mocked(buildNotePdf)).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: "CLIENTE SNAPSHOT SA",
        issuer: expect.objectContaining({
          name: "ROTHAMEL ORIGINAL",
          address: "DOMICILIO ORIGINAL",
        }),
      }),
    );
  });

  it("una nota autorizada sin issuerSnapshot falla", async () => {
    authorizedNote();
    vi.mocked(billingFiscalSettingsRepository.readEnvironment).mockResolvedValue(
      "PRODUCCION",
    );
    vi.mocked(arcaEmissionRepository.findByNoteId).mockResolvedValue({
      billingPayloadSnapshot: null,
    } as never);

    await expect(billingNoteService.generateNotePdf("note-1")).rejects.toMatchObject({
      code: "NOTE_FISCAL_ISSUER_MISSING",
    });
    expect(buildNotePdf).not.toHaveBeenCalled();
  });

  it("una nota interna sigue usando el emisor de la configuración vigente", async () => {
    vi.mocked(loadRothamelLogoPng).mockResolvedValue(null);
    vi.mocked(buildNotePdf).mockResolvedValue(new Uint8Array([1]));
    vi.mocked(billingFiscalSettingsRepository.readEnvironment).mockResolvedValue(
      "MODO_PRUEBA",
    );
    vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue({
      environment: "MODO_PRUEBA",
      issuerName: "ROTHAMEL NUEVO",
      issuerCuit: null,
      issuerAddress: "DOMICILIO NUEVO",
      issuerCity: null,
      issuerProvince: null,
      issuerIvaCondition: null,
      issuerGrossIncome: null,
      issuerActivitiesStartedAt: null,
    } as never);
    vi.mocked(billingNoteRepository.findById).mockResolvedValue({
      kind: "CREDIT",
      noteNumber: "0007-PRUEBA-NC-000000001",
      invoiceType: "A",
      environment: "MODO_PRUEBA",
      fiscalStatus: "INTERNA",
      issuedAt: new Date("2026-10-03T15:00:00.000Z"),
      amount: { toNumber: () => 100 },
      netAmount: { toNumber: () => 82.64 },
      ivaAmount: { toNumber: () => 17.36 },
      ivaPercent: { toNumber: () => 21 },
      reason: "Ajuste",
      clientName: "CLIENTE",
      clientCode: "CLI-0001",
      clientIdentificationType: "CUIT",
      clientIdentificationNumber: "30500010912",
      clientIvaCondition: "RESPONSABLE_INSCRIPTO",
      createdBy: { name: "Admin" },
      invoice: {
        invoiceNumber: "0007-PRUEBA-000000001",
        issuedAt: new Date("2026-09-30T15:00:00.000Z"),
      },
    } as never);

    await billingNoteService.generateNotePdf("note-1");

    expect(arcaEmissionRepository.findByNoteId).not.toHaveBeenCalled();
    expect(vi.mocked(buildNotePdf)).toHaveBeenCalledWith(
      expect.objectContaining({
        issuer: expect.objectContaining({
          name: "ROTHAMEL NUEVO",
          address: "DOMICILIO NUEVO",
        }),
      }),
    );
  });
});
