import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BillingClient,
  BillingFiscalSettings,
  BillingRubro,
} from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
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

const CLIENT_ID = "clbillingclient0000000001";
const RUBRO_ID = "clbillingrubro00000000001";

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
    clientId: CLIENT_ID,
    items: [{ rubroId: RUBRO_ID, quantity: 1, unitPrice: 1210 }],
    paymentMethod: "CONTADO_EFECTIVO" as const,
  };
}

describe("BillingInvoiceService", () => {
  beforeEach(() => {
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

    it("bloquea la emisión si el ambiente no es modo prueba", async () => {
      vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
        createSettingsFixture({ environment: "HOMOLOGACION" }),
      );

      await expect(
        billingInvoiceService.createInvoice(baseInput()),
      ).rejects.toMatchObject({ code: "ENVIRONMENT_NOT_SUPPORTED" });
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
