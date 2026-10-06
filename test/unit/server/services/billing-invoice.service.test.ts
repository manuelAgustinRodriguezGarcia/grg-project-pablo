import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BillingClient,
  BillingFiscalSettings,
  BillingRubro,
} from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { ArcaEmissionError } from "@/server/arca/errors/arca-emission.error";
import { AuthForbiddenError } from "@/server/auth/errors";
import { billingClientRepository } from "@/server/repositories/billing-client.repository";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import {
  billingInvoiceRepository,
  type BillingInvoiceWithItems,
  type CreateBillingInvoiceData,
} from "@/server/repositories/billing-invoice.repository";
import { billingRubroRepository } from "@/server/repositories/billing-rubro.repository";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
} from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { arcaEmissionRepository } from "@/server/arca/repositories/arca-emission.repository";
import { hashArcaFiscalRequest } from "@/server/arca/invoices/fiscal-request-hash";
import { finalizeApprovedArcaEmission } from "@/server/arca/invoices/finalize-approved-arca-emission";
import {
  issueArcaInvoice,
  type IssueArcaInvoiceInput,
} from "@/server/arca/invoices/issue-arca-invoice";
import { ARCA_RETRY_FISCAL_DATE_CHANGED_MESSAGE } from "@/server/services/billing-invoice.errors";
import { billingInvoiceService } from "@/server/services/billing-invoice.service";
import {
  adminUserFixture,
  mockRequirePermissionForbidden,
  mockRequireRole,
} from "../../../helpers/mocks/auth";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
  requireEditor: vi.fn(),
  requirePermission: vi.fn(),
  requireAnyPermission: vi.fn(),
}));
vi.mock("@/server/repositories/billing-client.repository", () => ({
  billingClientRepository: {
    findById: vi.fn(),
  },
}));
vi.mock("@/server/repositories/billing-rubro.repository", () => ({
  billingRubroRepository: {
    findByIds: vi.fn(),
  },
}));
vi.mock("@/server/repositories/billing-fiscal-settings.repository", () => ({
  billingFiscalSettingsRepository: {
    getOrCreate: vi.fn(),
  },
}));
vi.mock("@/server/repositories/billing-invoice.repository", () => ({
  billingInvoiceRepository: {
    findAllOrdered: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    getNextSequenceNumber: vi.fn(),
    isUniqueConstraintError: vi.fn(),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperation: vi.fn(),
    logOperationSafe: vi.fn(),
  },
}));
vi.mock("@/server/services/billing-invoice-settlement", () => ({
  releaseOverpaymentsForClient: vi.fn(),
}));
vi.mock("@/server/arca/repositories/arca-emission.repository", () => ({
  arcaEmissionRepository: {
    findByIdempotencyKey: vi.fn(),
  },
}));
vi.mock("@/server/arca/invoices/issue-arca-invoice", () => ({
  issueArcaInvoice: vi.fn(),
}));
vi.mock("@/server/arca/invoices/finalize-approved-arca-emission", () => ({
  finalizeApprovedArcaEmission: vi.fn(),
}));

const CLIENT_ID = "clbillingclient0000000001";
const RUBRO_ID = "clbillingrubro00000000001";
const IDEMPOTENCY_KEY = "11111111-1111-4111-8111-111111111111";
const ISSUED_AT = new Date("2026-09-30T15:00:00.000Z");

function persistedSnapshot(issuedAt = ISSUED_AT) {
  return {
    issuedAt: issuedAt.toISOString(),
    pointOfSale: 7,
    invoiceType: "A" as const,
    client: {
      id: CLIENT_ID,
      code: "GOMEZ-0001",
      name: "GOMEZ SRL",
      address: "Av. Siempreviva 742",
      city: "Resistencia",
      province: "Chaco",
      email: "gomez@mail.com",
      whatsapp: "+5493624000000",
      identificationType: "CUIT" as const,
      identificationNumber: "30500010912",
      ivaCondition: "RESPONSABLE_INSCRIPTO" as const,
    },
    items: [
      {
        rubroId: RUBRO_ID,
        rubroCode: "EMB-0001",
        rubroName: "Embragues",
        description: "Embragues y componentes",
        quantity: 1,
        unitPriceCents: 121000,
        lineTotalCents: 121000,
        sortOrder: 0,
      },
    ],
    financial: {
      subtotalCents: 100000,
      discountPercent: 0,
      discountAmountCents: 0,
      ivaPercent: 21,
      ivaAmountCents: 21000,
      totalCents: 121000,
      totalVisualRoundedCents: 121000,
      netCents: 100000,
      nonTaxedCents: 0,
      exemptCents: 0,
      taxCents: 0,
    },
    paymentMethod: "CONTADO_EFECTIVO" as const,
    paymentStatus: "PAGA" as const,
    notes: null,
  };
}

function createClientFixture(
  overrides: Partial<BillingClient> = {},
): BillingClient {
  return {
    id: CLIENT_ID,
    code: "GOMEZ-0001",
    codeNumber: 1,
    name: "GOMEZ SRL",
    address: "Av. Siempreviva 742",
    city: "Resistencia",
    province: "Chaco",
    email: "gomez@mail.com",
    whatsapp: "+5493624000000",
    identificationType: "CUIT",
    identificationNumber: "30500010912",
    ivaCondition: "RESPONSABLE_INSCRIPTO",
    notes: null,
    createdAt: new Date("2026-08-01T12:00:00Z"),
    updatedAt: new Date("2026-08-01T12:00:00Z"),
    ...overrides,
  };
}

function createRubroFixture(
  overrides: Partial<BillingRubro> = {},
): BillingRubro {
  return {
    id: RUBRO_ID,
    code: "EMB-0001",
    codeNumber: 1,
    name: "Embragues",
    description: "Embragues y componentes",
    status: "ACTIVE",
    createdAt: new Date("2026-08-01T12:00:00Z"),
    updatedAt: new Date("2026-08-01T12:00:00Z"),
    ...overrides,
  };
}

function createSettingsFixture(
  overrides: Partial<BillingFiscalSettings> = {},
): BillingFiscalSettings {
  return {
    id: "fiscal-settings",
    ivaPercent: new Prisma.Decimal(21),
    genericClientLimit: new Prisma.Decimal(400000),
    pointOfSale: "0007",
    environment: "MODO_PRUEBA",
    issuerName: null,
    issuerCuit: null,
    issuerAddress: null,
    issuerCity: null,
    issuerProvince: null,
    issuerIvaCondition: null,
    issuerGrossIncome: null,
    issuerActivitiesStartedAt: null,
    createdAt: new Date("2026-08-01T12:00:00Z"),
    updatedAt: new Date("2026-08-01T12:00:00Z"),
    ...overrides,
  };
}

const PROD_CERTIFICATE = `-----BEGIN CERTIFICATE-----
DUMMY-CERT
-----END CERTIFICATE-----
`;

const PROD_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
DUMMY-KEY
-----END PRIVATE KEY-----
`;

function encodePem(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function completeProductionSettings(): BillingFiscalSettings {
  return createSettingsFixture({
    environment: "PRODUCCION",
    issuerName: "Emisor SA",
    issuerCuit: "30712345671",
    issuerAddress: "Calle 1",
    issuerCity: "Resistencia",
    issuerProvince: "Chaco",
    issuerIvaCondition: "Responsable Inscripto",
    issuerGrossIncome: "IIBB",
    issuerActivitiesStartedAt: "2004-03-15",
    pointOfSale: "0007",
  });
}

function mockCreatePassthrough(): void {
  vi.mocked(billingInvoiceRepository.create).mockImplementation(
    async (data: CreateBillingInvoiceData) => {
      const { items, ...invoice } = data;
      return {
        id: "clbillinginvoice000000001",
        ...invoice,
        notes: invoice.notes,
        cae: null,
        caeExpiresAt: null,
        qrUrl: null,
        pdfPath: null,
        printedAt: null,
        downloadedAt: null,
        sharedAt: null,
        issuedAt: new Date("2026-08-19T15:00:00Z"),
        createdAt: new Date("2026-08-19T15:00:00Z"),
        updatedAt: new Date("2026-08-19T15:00:00Z"),
        allocations: [],
        billingNotes: [],
        items: items.map((item, index) => ({
          id: `item-${index}`,
          invoiceId: "clbillinginvoice000000001",
          createdAt: new Date("2026-08-19T15:00:00Z"),
          ...item,
        })),
      } as BillingInvoiceWithItems;
    },
  );
}

function baseInput() {
  return {
    idempotencyKey: IDEMPOTENCY_KEY,
    clientId: CLIENT_ID,
    items: [{ rubroId: RUBRO_ID, quantity: 1, unitPrice: 1210 }],
    paymentMethod: "CONTADO_EFECTIVO" as const,
  };
}

function storedAuthorizedInvoice(): BillingInvoiceWithItems {
  return {
    id: "clbillinginvoicearca000001",
    environment: "HOMOLOGACION",
    fiscalStatus: "AUTORIZADA",
    invoiceType: "A",
    pointOfSale: "0007",
    sequenceNumber: 3,
    invoiceNumber: "0007-00000003",
    cae: "12345678901234",
    caeExpiresAt: new Date("2026-10-10T00:00:00.000Z"),
    items: [],
    allocations: [],
    billingNotes: [],
  } as unknown as BillingInvoiceWithItems;
}

function mockApprovedIssue(): void {
  vi.mocked(issueArcaInvoice).mockResolvedValue({
    status: "approved",
    emissionId: "emission-1",
    voucherType: 1,
    voucherNumber: 3,
    authorizationCode: "12345678901234",
    authorizationExpiresAt: "20261010",
  });
  vi.mocked(finalizeApprovedArcaEmission).mockResolvedValue({
    status: "completed",
    emissionId: "emission-1",
    invoice: { id: "clbillinginvoicearca000001" },
  } as Awaited<ReturnType<typeof finalizeApprovedArcaEmission>>);
  vi.mocked(billingInvoiceRepository.findById).mockResolvedValue(
    storedAuthorizedInvoice(),
  );
}

describe("BillingInvoiceService", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    vi.mocked(billingClientRepository.findById).mockResolvedValue(
      createClientFixture(),
    );
    vi.mocked(billingRubroRepository.findByIds).mockResolvedValue([
      createRubroFixture(),
    ]);
    vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
      createSettingsFixture(),
    );
    vi.mocked(
      billingInvoiceRepository.getNextSequenceNumber,
    ).mockResolvedValue(1);
    vi.mocked(
      billingInvoiceRepository.isUniqueConstraintError,
    ).mockReturnValue(false);
    mockCreatePassthrough();
    vi.mocked(arcaEmissionRepository.findByIdempotencyKey).mockResolvedValue(null);
  });

  describe("createInvoice", () => {
    it("crea Factura A para CUIT + Responsable Inscripto con snapshot y numeración de prueba", async () => {
      const invoice = await billingInvoiceService.createInvoice(baseInput());

      expect(billingInvoiceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: "MODO_PRUEBA",
          fiscalStatus: "MODO_PRUEBA",
          invoiceType: "A",
          pointOfSale: "0007",
          sequenceNumber: 1,
          invoiceNumber: "0007-PRUEBA-000000001",
          clientId: CLIENT_ID,
          clientCode: "GOMEZ-0001",
          clientName: "GOMEZ SRL",
          clientIdentificationType: "CUIT",
          clientIdentificationNumber: "30500010912",
          clientIvaCondition: "RESPONSABLE_INSCRIPTO",
          paymentStatus: "PAGA",
        }),
      );

      const created = vi.mocked(billingInvoiceRepository.create).mock
        .calls[0][0];
      expect(created.subtotal.toString()).toBe("1000");
      expect(created.ivaAmount.toString()).toBe("210");
      expect(created.total.toString()).toBe("1210");
      expect(created.totalVisualRounded.toString()).toBe("1210");
      expect(created.items).toHaveLength(1);
      expect(created.items[0]).toMatchObject({
        rubroId: RUBRO_ID,
        rubroCode: "EMB-0001",
        rubroName: "Embragues",
        description: "Embragues y componentes",
        sortOrder: 0,
      });
      expect(created.items[0].unitPrice.toString()).toBe("1210");
      expect(created.items[0].lineTotal.toString()).toBe("1210");

      expect(auditService.logOperationSafe).toHaveBeenCalledWith({
        userId: adminUserFixture.id,
        action: AUDIT_ACTIONS.BILLING_INVOICE_CREATED,
        entityType: AUDIT_ENTITY_TYPES.BILLING_INVOICE,
        entityId: invoice.id,
      });
      expect(issueArcaInvoice).not.toHaveBeenCalled();
      expect(finalizeApprovedArcaEmission).not.toHaveBeenCalled();
      expect(billingInvoiceRepository.getNextSequenceNumber).toHaveBeenCalled();
    });

    it("crea Factura B para cliente con DNI consumidor final", async () => {
      vi.mocked(billingClientRepository.findById).mockResolvedValue(
        createClientFixture({
          identificationType: "DNI",
          identificationNumber: "12345678",
          ivaCondition: "CONSUMIDOR_FINAL",
        }),
      );

      await billingInvoiceService.createInvoice(baseInput());

      const created = vi.mocked(billingInvoiceRepository.create).mock
        .calls[0][0];
      expect(created.invoiceType).toBe("B");
      // Factura B: el subtotal es el precio final con IVA incluido.
      expect(created.subtotal.toString()).toBe("1210");
    });

    it("marca paga los métodos inmediatos e impaga la cuenta corriente", async () => {
      await billingInvoiceService.createInvoice({
        ...baseInput(),
        paymentMethod: "CONTADO",
      });
      expect(
        vi.mocked(billingInvoiceRepository.create).mock.calls[0][0]
          .paymentStatus,
      ).toBe("PAGA");

      vi.mocked(billingInvoiceRepository.create).mockClear();
      mockCreatePassthrough();

      await billingInvoiceService.createInvoice({
        ...baseInput(),
        paymentMethod: "CUENTA_CORRIENTE",
      });
      expect(
        vi.mocked(billingInvoiceRepository.create).mock.calls[0][0]
          .paymentStatus,
      ).toBe("IMPAGA");
    });

    it("rechaza cantidades o precios por encima del máximo permitido", async () => {
      await expect(
        billingInvoiceService.createInvoice({
          ...baseInput(),
          items: [{ rubroId: RUBRO_ID, quantity: 100, unitPrice: 1210 }],
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

      await expect(
        billingInvoiceService.createInvoice({
          ...baseInput(),
          items: [
            { rubroId: RUBRO_ID, quantity: 1, unitPrice: 100_000_000 },
          ],
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("permite sobrescribir la descripción del rubro solo para la factura", async () => {
      await billingInvoiceService.createInvoice({
        ...baseInput(),
        items: [
          {
            rubroId: RUBRO_ID,
            description: "  Embrague completo Mercedes 1114  ",
            quantity: 1,
            unitPrice: 1210,
          },
        ],
      });

      const created = vi.mocked(billingInvoiceRepository.create).mock
        .calls[0][0];
      expect(created.items[0].description).toBe(
        "Embrague completo Mercedes 1114",
      );
    });

    it("bloquea al cliente genérico sin datos cuando supera el límite", async () => {
      vi.mocked(billingClientRepository.findById).mockResolvedValue(
        createClientFixture({
          identificationType: "NINGUNO",
          identificationNumber: null,
          ivaCondition: "CONSUMIDOR_FINAL",
          email: null,
          whatsapp: null,
        }),
      );

      await expect(
        billingInvoiceService.createInvoice({
          ...baseInput(),
          items: [{ rubroId: RUBRO_ID, quantity: 1, unitPrice: 400000.01 }],
        }),
      ).rejects.toMatchObject({ code: "GENERIC_CLIENT_LIMIT_EXCEEDED" });

      expect(billingInvoiceRepository.create).not.toHaveBeenCalled();
    });

    it("permite al cliente genérico facturar hasta el límite vigente", async () => {
      vi.mocked(billingClientRepository.findById).mockResolvedValue(
        createClientFixture({
          identificationType: "NINGUNO",
          identificationNumber: null,
          ivaCondition: "CONSUMIDOR_FINAL",
          email: null,
          whatsapp: null,
        }),
      );

      await billingInvoiceService.createInvoice({
        ...baseInput(),
        items: [{ rubroId: RUBRO_ID, quantity: 1, unitPrice: 400000 }],
      });

      expect(billingInvoiceRepository.create).toHaveBeenCalled();
    });

    it("rechaza cuenta corriente para cliente sin identificación", async () => {
      vi.mocked(billingClientRepository.findById).mockResolvedValue(
        createClientFixture({
          identificationType: "NINGUNO",
          identificationNumber: null,
          ivaCondition: "CONSUMIDOR_FINAL",
          email: null,
          whatsapp: null,
        }),
      );

      await expect(
        billingInvoiceService.createInvoice({
          ...baseInput(),
          paymentMethod: "CUENTA_CORRIENTE",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

      expect(billingInvoiceRepository.create).not.toHaveBeenCalled();
    });

    it("no aplica el límite a clientes con datos de contacto", async () => {
      vi.mocked(billingClientRepository.findById).mockResolvedValue(
        createClientFixture({
          identificationType: "NINGUNO",
          identificationNumber: null,
          ivaCondition: "CONSUMIDOR_FINAL",
          email: "cliente@mail.com",
          whatsapp: null,
        }),
      );

      await billingInvoiceService.createInvoice({
        ...baseInput(),
        items: [{ rubroId: RUBRO_ID, quantity: 1, unitPrice: 500000 }],
      });

      expect(billingInvoiceRepository.create).toHaveBeenCalled();
    });

    it("aplica descuento sobre el subtotal", async () => {
      await billingInvoiceService.createInvoice({
        ...baseInput(),
        items: [{ rubroId: RUBRO_ID, quantity: 1, unitPrice: 10000 }],
        discountPercent: 10,
      });

      const created = vi.mocked(billingInvoiceRepository.create).mock
        .calls[0][0];
      expect(created.discountPercent.toString()).toBe("10");
      expect(created.total.toString()).toBe("9000");
    });

    it("rechaza rubros inexistentes", async () => {
      vi.mocked(billingRubroRepository.findByIds).mockResolvedValue([]);

      await expect(
        billingInvoiceService.createInvoice(baseInput()),
      ).rejects.toMatchObject({ code: "BILLING_RUBRO_NOT_FOUND" });
    });

    it("rechaza rubros inactivos", async () => {
      vi.mocked(billingRubroRepository.findByIds).mockResolvedValue([
        createRubroFixture({ status: "INACTIVE" }),
      ]);

      await expect(
        billingInvoiceService.createInvoice(baseInput()),
      ).rejects.toMatchObject({ code: "BILLING_RUBRO_INACTIVE" });
    });

    it("rechaza la creación si el cliente no existe", async () => {
      vi.mocked(billingClientRepository.findById).mockResolvedValue(null);

      await expect(
        billingInvoiceService.createInvoice(baseInput()),
      ).rejects.toMatchObject({ code: "BILLING_CLIENT_NOT_FOUND" });
    });

    it("rechaza facturas sin ítems", async () => {
      await expect(
        billingInvoiceService.createInvoice({ ...baseInput(), items: [] }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("rechaza cantidades y precios inválidos", async () => {
      await expect(
        billingInvoiceService.createInvoice({
          ...baseInput(),
          items: [{ rubroId: RUBRO_ID, quantity: 0, unitPrice: 100 }],
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

      await expect(
        billingInvoiceService.createInvoice({
          ...baseInput(),
          items: [{ rubroId: RUBRO_ID, quantity: 1, unitPrice: -5 }],
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("rechaza descuentos fuera de rango", async () => {
      await expect(
        billingInvoiceService.createInvoice({
          ...baseInput(),
          discountPercent: 100,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("bloquea producción si el kill switch no es exactamente true", async () => {
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({ environment: "PRODUCCION" }),
      );

      for (const value of [undefined, "false", "TRUE", "1", " yes "]) {
        if (value === undefined) {
          vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "");
          delete process.env.ARCA_PRODUCTION_EMISSION_ENABLED;
        } else {
          vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", value);
        }

        await expect(
          billingInvoiceService.createInvoice(baseInput()),
        ).rejects.toMatchObject({
          code: "PRODUCTION_EMISSION_DISABLED",
          message: "La emisión en producción no está habilitada.",
        });
      }

      expect(issueArcaInvoice).not.toHaveBeenCalled();
      expect(billingInvoiceRepository.create).not.toHaveBeenCalled();
    });

    it("no llama a ARCA si la configuración fiscal de producción está incompleta", async () => {
      vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "true");
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "PRODUCCION",
          issuerName: "Emisor SA",
          issuerCuit: "30712345671",
        }),
      );

      await expect(
        billingInvoiceService.createInvoice(baseInput()),
      ).rejects.toMatchObject({
        code: "ARCA_PRODUCTION_CONFIGURATION_INCOMPLETE",
      });
      expect(issueArcaInvoice).not.toHaveBeenCalled();
    });

    it("no llama a ARCA si faltan las credenciales productivas", async () => {
      vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "true");
      vi.stubEnv("ARCA_PROD_CERT_B64", "");
      vi.stubEnv("ARCA_PROD_PRIVATE_KEY_B64", "");
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        completeProductionSettings(),
      );

      await expect(
        billingInvoiceService.createInvoice(baseInput()),
      ).rejects.toMatchObject({
        code: "ARCA_CONFIGURATION_ERROR",
        message: "Las credenciales de ARCA para producción no están disponibles.",
      });
      expect(issueArcaInvoice).not.toHaveBeenCalled();
    });

    it("con flag y configuración completa entra al mismo flujo de emisión", async () => {
      vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "true");
      vi.stubEnv("ARCA_PROD_CERT_B64", encodePem(PROD_CERTIFICATE));
      vi.stubEnv("ARCA_PROD_PRIVATE_KEY_B64", encodePem(PROD_PRIVATE_KEY));
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        completeProductionSettings(),
      );
      mockApprovedIssue();
      vi.mocked(billingInvoiceRepository.findById).mockResolvedValue({
        ...storedAuthorizedInvoice(),
        environment: "PRODUCCION",
      });

      const invoice = await billingInvoiceService.createInvoice(baseInput(), {
        now: ISSUED_AT,
      });

      expect(issueArcaInvoice).toHaveBeenCalledTimes(1);
      expect(issueArcaInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: "PRODUCCION",
          invoiceType: "A",
          pointOfSale: 7,
        }),
      );
      expect(finalizeApprovedArcaEmission).toHaveBeenCalledWith("emission-1");
      expect(invoice.environment).toBe("PRODUCCION");
    });

    it("en homologación emite aunque el kill switch esté cerrado", async () => {
      vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "false");
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "HOMOLOGACION",
          issuerCuit: "30712345671",
        }),
      );
      mockApprovedIssue();

      await billingInvoiceService.createInvoice(baseInput(), { now: ISSUED_AT });

      expect(issueArcaInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ environment: "HOMOLOGACION" }),
      );
    });

    it("en modo prueba no usa el kill switch ni ARCA", async () => {
      vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "false");

      const invoice = await billingInvoiceService.createInvoice(baseInput());

      expect(invoice.environment).toBe("MODO_PRUEBA");
      expect(issueArcaInvoice).not.toHaveBeenCalled();
    });

    it("en homologación arma el snapshot, emite una vez y persiste la factura autorizada", async () => {
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "HOMOLOGACION",
          issuerCuit: "30712345671",
        }),
      );
      mockApprovedIssue();

      const invoice = await billingInvoiceService.createInvoice(baseInput(), {
        now: ISSUED_AT,
      });

      expect(issueArcaInvoice).toHaveBeenCalledTimes(1);
      expect(finalizeApprovedArcaEmission).toHaveBeenCalledTimes(1);
      expect(finalizeApprovedArcaEmission).toHaveBeenCalledWith("emission-1");
      expect(billingInvoiceRepository.getNextSequenceNumber).not.toHaveBeenCalled();
      expect(billingInvoiceRepository.create).not.toHaveBeenCalled();
      expect(invoice.id).toBe("clbillinginvoicearca000001");
      expect(invoice.fiscalStatus).toBe("AUTORIZADA");
      expect(invoice.invoiceNumber).toBe("0007-00000003");

      const request = vi.mocked(issueArcaInvoice).mock.calls[0][0];
      expect(request.idempotencyKey).toBe(IDEMPOTENCY_KEY);
      expect(request.environment).toBe("HOMOLOGACION");
      expect(request.voucherDate).toBe(ISSUED_AT);
      expect(request.billing.issuedAt).toBe(ISSUED_AT.toISOString());
      expect(request.billing.client.name).toBe("GOMEZ SRL");
      expect(request.billing.items[0]?.description).toBe(
        "Embragues y componentes",
      );
      expect(request.totals.totalCents).toBe(request.billing.financial.totalCents);
      expect(request.totals.netCents).toBe(request.billing.financial.netCents);
      expect(request.billing.financial.totalVisualRoundedCents).toBe(121000);
      expect(request.totals).not.toHaveProperty("totalVisualRoundedCents");
      expect(
        vi.mocked(issueArcaInvoice).mock.invocationCallOrder[0],
      ).toBeLessThan(
        vi.mocked(finalizeApprovedArcaEmission).mock.invocationCallOrder[0],
      );
      expect(auditService.logOperationSafe).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: invoice.id }),
      );
    });

    it("no finaliza si ARCA rechaza el comprobante", async () => {
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "HOMOLOGACION",
          issuerCuit: "30712345671",
        }),
      );
      vi.mocked(issueArcaInvoice).mockResolvedValue({
        status: "rejected",
        emissionId: "emission-1",
        voucherType: 1,
        voucherNumber: 3,
      });

      await expect(
        billingInvoiceService.createInvoice(baseInput(), { now: ISSUED_AT }),
      ).rejects.toMatchObject({
        code: "ARCA_INVOICE_REJECTED",
        message: "ARCA rechazó el comprobante.",
      });
      expect(finalizeApprovedArcaEmission).not.toHaveBeenCalled();
      expect(billingInvoiceRepository.create).not.toHaveBeenCalled();
    });

    it("no finaliza si el estado en ARCA queda ambiguo", async () => {
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "HOMOLOGACION",
          issuerCuit: "30712345671",
        }),
      );
      vi.mocked(issueArcaInvoice).mockResolvedValue({
        status: "ambiguous",
        emissionId: "emission-1",
        voucherType: 1,
        voucherNumber: 3,
        code: "ARCA_AMBIGUOUS_VOUCHER_MISMATCH",
      });

      await expect(
        billingInvoiceService.createInvoice(baseInput(), { now: ISSUED_AT }),
      ).rejects.toMatchObject({
        code: "ARCA_EMISSION_STATUS_UNCERTAIN",
        message:
          "No se pudo confirmar el estado del comprobante en ARCA. Volvé a intentar sin modificar la factura.",
      });
      expect(finalizeApprovedArcaEmission).not.toHaveBeenCalled();
      expect(billingInvoiceRepository.create).not.toHaveBeenCalled();
    });

    it("no finaliza si la emisión falla antes del envío", async () => {
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "HOMOLOGACION",
          issuerCuit: "30712345671",
        }),
      );
      vi.mocked(issueArcaInvoice).mockResolvedValue({
        status: "failed_pre_send",
        emissionId: "emission-1",
        code: "INVALID_TICKET",
        message: "No se pudo obtener el ticket.",
      });

      await expect(
        billingInvoiceService.createInvoice(baseInput(), { now: ISSUED_AT }),
      ).rejects.toMatchObject({
        code: "ARCA_EMISSION_FAILED_PRE_SEND",
        message: "No se pudo obtener el ticket.",
      });
      expect(finalizeApprovedArcaEmission).not.toHaveBeenCalled();
      expect(billingInvoiceRepository.create).not.toHaveBeenCalled();
    });

    it("informa persistencia pendiente si ARCA aprobó y el guardado local falla", async () => {
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "HOMOLOGACION",
          issuerCuit: "30712345671",
        }),
      );
      mockApprovedIssue();
      vi.mocked(finalizeApprovedArcaEmission).mockRejectedValue(
        new Error("SOAP token Sign private key"),
      );

      await expect(
        billingInvoiceService.createInvoice(baseInput(), { now: ISSUED_AT }),
      ).rejects.toMatchObject({
        code: "ARCA_APPROVED_LOCAL_PERSISTENCE_PENDING",
        message:
          "ARCA autorizó el comprobante, pero no pudo completarse el guardado local. Volvé a intentar sin modificar la factura.",
      });
      expect(billingInvoiceRepository.create).not.toHaveBeenCalled();
      expect(auditService.logOperationSafe).not.toHaveBeenCalled();
    });

    it("reintenta la misma clave sin crear otra factura local", async () => {
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "HOMOLOGACION",
          issuerCuit: "30712345671",
        }),
      );
      mockApprovedIssue();
      vi.mocked(issueArcaInvoice)
        .mockResolvedValueOnce({
          status: "approved",
          emissionId: "emission-1",
          voucherType: 1,
          voucherNumber: 3,
          authorizationCode: "12345678901234",
          authorizationExpiresAt: "20261010",
        })
        .mockResolvedValueOnce({
          status: "completed",
          emissionId: "emission-1",
          voucherType: 1,
          voucherNumber: 3,
          authorizationCode: "12345678901234",
          authorizationExpiresAt: "20261010",
        });

      const first = await billingInvoiceService.createInvoice(baseInput(), {
        now: ISSUED_AT,
      });
      const second = await billingInvoiceService.createInvoice(baseInput(), {
        now: ISSUED_AT,
      });

      expect(first.id).toBe(second.id);
      expect(issueArcaInvoice).toHaveBeenCalledTimes(2);
      expect(vi.mocked(issueArcaInvoice).mock.calls[0][0].idempotencyKey).toBe(
        IDEMPOTENCY_KEY,
      );
      expect(vi.mocked(issueArcaInvoice).mock.calls[1][0].idempotencyKey).toBe(
        IDEMPOTENCY_KEY,
      );
      expect(finalizeApprovedArcaEmission).toHaveBeenCalledTimes(2);
      expect(billingInvoiceRepository.create).not.toHaveBeenCalled();
      expect(billingInvoiceRepository.getNextSequenceNumber).not.toHaveBeenCalled();
    });

    it("recupera una emisión de producción con kill switch apagado y configuración incompleta", async () => {
      vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "false");
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "PRODUCCION",
          pointOfSale: "",
          issuerName: "EMISOR NUEVO",
          issuerCuit: null,
          issuerAddress: null,
          issuerGrossIncome: null,
          issuerActivitiesStartedAt: null,
        }),
      );
      vi.mocked(arcaEmissionRepository.findByIdempotencyKey).mockResolvedValue({
        environment: "PRODUCCION",
        issuerCuit: "30712345671",
        pointOfSale: 7,
        status: "APPROVED_PENDING_PERSISTENCE",
        billingPayloadSnapshot: persistedSnapshot(),
      } as never);
      mockApprovedIssue();

      const invoice = await billingInvoiceService.createInvoice(baseInput(), {
        now: ISSUED_AT,
      });

      expect(issueArcaInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: "PRODUCCION",
          issuerCuit: "30712345671",
          pointOfSale: 7,
          idempotencyKey: IDEMPOTENCY_KEY,
        }),
      );
      expect(finalizeApprovedArcaEmission).toHaveBeenCalledWith("emission-1");
      expect(invoice.id).toBe("clbillinginvoicearca000001");
      expect(billingInvoiceRepository.create).not.toHaveBeenCalled();
    });

    it("devuelve la factura completada sin exigir la configuración vigente", async () => {
      vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "false");
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "PRODUCCION",
          pointOfSale: "",
          issuerCuit: null,
          issuerName: null,
        }),
      );
      vi.mocked(arcaEmissionRepository.findByIdempotencyKey).mockResolvedValue({
        environment: "PRODUCCION",
        issuerCuit: "30712345671",
        pointOfSale: 7,
        status: "COMPLETED",
        billingPayloadSnapshot: persistedSnapshot(),
      } as never);
      vi.mocked(issueArcaInvoice).mockResolvedValue({
        status: "completed",
        emissionId: "emission-1",
        voucherType: 1,
        voucherNumber: 3,
        authorizationCode: "12345678901234",
        authorizationExpiresAt: "20261010",
      });
      vi.mocked(finalizeApprovedArcaEmission).mockResolvedValue({
        status: "completed",
        emissionId: "emission-1",
        invoice: { id: "clbillinginvoicearca000001" },
      } as Awaited<ReturnType<typeof finalizeApprovedArcaEmission>>);
      vi.mocked(billingInvoiceRepository.findById).mockResolvedValue({
        ...storedAuthorizedInvoice(),
        environment: "PRODUCCION",
      });

      const invoice = await billingInvoiceService.createInvoice(baseInput(), {
        now: ISSUED_AT,
      });

      expect(invoice.id).toBe("clbillinginvoicearca000001");
      expect(issueArcaInvoice).toHaveBeenCalledTimes(1);
      expect(billingInvoiceRepository.create).not.toHaveBeenCalled();
    });

    it("mantiene el conflicto si la misma clave llega con otro importe", async () => {
      vi.mocked(arcaEmissionRepository.findByIdempotencyKey).mockResolvedValue({
        environment: "PRODUCCION",
        issuerCuit: "30712345671",
        pointOfSale: 7,
        status: "FAILED_PRE_SEND",
        billingPayloadSnapshot: persistedSnapshot(),
      } as never);
      vi.mocked(issueArcaInvoice).mockRejectedValue(
        new ArcaEmissionError(
          "La clave de idempotencia ya se usó con otros datos.",
          "ARCA_IDEMPOTENCY_CONFLICT",
        ),
      );

      await expect(
        billingInvoiceService.createInvoice(
          {
            ...baseInput(),
            items: [{ rubroId: RUBRO_ID, quantity: 2, unitPrice: 1210 }],
          },
          { now: ISSUED_AT },
        ),
      ).rejects.toMatchObject({
        code: "ARCA_IDEMPOTENCY_CONFLICT",
      });
      expect(issueArcaInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: IDEMPOTENCY_KEY,
          issuerCuit: "30712345671",
        }),
      );
      expect(billingInvoiceRepository.create).not.toHaveBeenCalled();
    });

    it("reutiliza el issuedAt persistido en un retry del mismo día fiscal", async () => {
      const issuedAt = new Date("2026-10-06T12:48:12.682Z");
      const retryNow = new Date("2026-10-06T13:09:26.277Z");
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "HOMOLOGACION",
          issuerCuit: "30712345671",
        }),
      );
      vi.mocked(arcaEmissionRepository.findByIdempotencyKey).mockResolvedValue({
        environment: "HOMOLOGACION",
        issuerCuit: "30712345671",
        pointOfSale: 7,
        status: "FAILED_PRE_SEND",
        requestHash: "same-day-hash-is-checked-later",
        billingPayloadSnapshot: persistedSnapshot(issuedAt),
      } as never);
      mockApprovedIssue();

      await billingInvoiceService.createInvoice(baseInput(), { now: retryNow });

      const request = vi.mocked(issueArcaInvoice).mock.calls[0]?.[0];
      expect(request?.billing.issuedAt).toBe(issuedAt.toISOString());
      expect(request?.voucherDate).toEqual(issuedAt);
      expect(request?.now).toEqual(retryNow);
    });

    it("mantiene el conflicto si el mismo día cambian notas o el pago", async () => {
      const issuedAt = new Date("2026-10-06T12:48:12.682Z");
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "HOMOLOGACION",
          issuerCuit: "30712345671",
        }),
      );
      vi.mocked(arcaEmissionRepository.findByIdempotencyKey).mockResolvedValue({
        environment: "HOMOLOGACION",
        issuerCuit: "30712345671",
        pointOfSale: 7,
        status: "FAILED_PRE_SEND",
        billingPayloadSnapshot: persistedSnapshot(issuedAt),
      } as never);
      vi.mocked(issueArcaInvoice).mockRejectedValue(
        new ArcaEmissionError(
          "La clave de idempotencia ya se usó con otros datos.",
          "ARCA_IDEMPOTENCY_CONFLICT",
        ),
      );

      await expect(
        billingInvoiceService.createInvoice(
          { ...baseInput(), notes: "urgente", paymentMethod: "TARJETA" },
          { now: new Date("2026-10-06T13:09:26.277Z") },
        ),
      ).rejects.toMatchObject({ code: "ARCA_IDEMPOTENCY_CONFLICT" });

      const request = vi.mocked(issueArcaInvoice).mock.calls[0]?.[0];
      expect(request?.billing.issuedAt).toBe(issuedAt.toISOString());
      expect(request?.billing.notes).toBe("urgente");
      expect(request?.billing.paymentMethod).toBe("TARJETA");
    });

    it("no llama a la emisión si el día fiscal cambió y la intención es la misma", async () => {
      const issuedAt = new Date("2026-10-06T12:48:12.682Z");
      let captured: IssueArcaInvoiceInput | undefined;
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "HOMOLOGACION",
          issuerCuit: "30712345671",
        }),
      );
      vi.mocked(issueArcaInvoice).mockImplementation(async (input) => {
        captured = input;
        return {
          status: "failed_pre_send",
          emissionId: "emission-1",
          code: "NETWORK_ERROR",
          message: "No se pudo conectar con WSFEv1.",
        };
      });

      await expect(
        billingInvoiceService.createInvoice(baseInput(), { now: issuedAt }),
      ).rejects.toMatchObject({ code: "ARCA_EMISSION_FAILED_PRE_SEND" });

      if (!captured) {
        throw new Error("No se capturó el pedido fiscal.");
      }

      vi.mocked(arcaEmissionRepository.findByIdempotencyKey).mockResolvedValue({
        environment: "HOMOLOGACION",
        issuerCuit: captured.issuerCuit,
        pointOfSale: captured.pointOfSale,
        status: "FAILED_PRE_SEND",
        requestHash: hashArcaFiscalRequest(captured),
        billingPayloadSnapshot: captured.billing,
      } as never);

      await expect(
        billingInvoiceService.createInvoice(baseInput(), {
          now: new Date("2026-10-07T15:00:00.000Z"),
        }),
      ).rejects.toMatchObject({
        code: "ARCA_RETRY_FISCAL_DATE_CHANGED",
        message: ARCA_RETRY_FISCAL_DATE_CHANGED_MESSAGE,
      });
      expect(issueArcaInvoice).toHaveBeenCalledTimes(1);
    });

    it("prioriza el conflicto de datos si el día fiscal cambió y el importe también", async () => {
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({
          environment: "HOMOLOGACION",
          issuerCuit: "30712345671",
        }),
      );
      vi.mocked(arcaEmissionRepository.findByIdempotencyKey).mockResolvedValue({
        environment: "HOMOLOGACION",
        issuerCuit: "30712345671",
        pointOfSale: 7,
        status: "FAILED_PRE_SEND",
        requestHash: "hash-de-otra-intencion",
        billingPayloadSnapshot: persistedSnapshot(
          new Date("2026-10-06T12:48:12.682Z"),
        ),
      } as never);

      await expect(
        billingInvoiceService.createInvoice(
          {
            ...baseInput(),
            items: [{ rubroId: RUBRO_ID, quantity: 2, unitPrice: 1210 }],
          },
          { now: new Date("2026-10-07T15:00:00.000Z") },
        ),
      ).rejects.toMatchObject({ code: "ARCA_IDEMPOTENCY_CONFLICT" });
      expect(issueArcaInvoice).not.toHaveBeenCalled();
    });

    it("reintenta la numeración ante un conflicto de unicidad", async () => {
      vi.mocked(billingInvoiceRepository.getNextSequenceNumber)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(8);
      vi.mocked(
        billingInvoiceRepository.isUniqueConstraintError,
      ).mockReturnValue(true);

      const passthrough = vi.mocked(billingInvoiceRepository.create)
        .getMockImplementation();
      vi.mocked(billingInvoiceRepository.create)
        .mockRejectedValueOnce(new Error("unique"))
        .mockImplementationOnce(passthrough!);

      await billingInvoiceService.createInvoice(baseInput());

      expect(billingInvoiceRepository.create).toHaveBeenCalledTimes(2);
      const secondCall = vi.mocked(billingInvoiceRepository.create).mock
        .calls[1][0];
      expect(secondCall.invoiceNumber).toBe("0007-PRUEBA-000000008");
    });

    it("rechaza VISITANTE al crear facturas", async () => {
      mockRequirePermissionForbidden();

      await expect(
        billingInvoiceService.createInvoice(baseInput()),
      ).rejects.toBeInstanceOf(AuthForbiddenError);
    });
  });

  describe("getInvoice", () => {
    it("lanza BILLING_INVOICE_NOT_FOUND si no existe", async () => {
      vi.mocked(billingInvoiceRepository.findById).mockResolvedValue(null);

      await expect(
        billingInvoiceService.getInvoice("inexistente"),
      ).rejects.toMatchObject({ code: "BILLING_INVOICE_NOT_FOUND" });
    });
  });
});
