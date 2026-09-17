import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingClient } from "@/generated/prisma/client";
import { AuthForbiddenError } from "@/server/auth/errors";
import { billingClientRepository } from "@/server/repositories/billing-client.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { BillingClientError } from "@/server/services/billing-client.errors";
import { billingClientService } from "@/server/services/billing-client.service";
import {
  adminUserFixture,
  mockRequireRole,
  mockRequireRoleForbidden,
} from "../../../helpers/mocks/auth";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
  requireEditor: vi.fn(),
}));
vi.mock("@/server/repositories/billing-client.repository", () => ({
  billingClientRepository: {
    findAllOrdered: vi.fn(),
    findById: vi.fn(),
    findByCode: vi.fn(),
    findByIdentification: vi.fn(),
    findCanonicalGeneric: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getNextCodeNumber: vi.fn(),
    isUniqueConstraintError: vi.fn(),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperation: vi.fn(),
    logOperationSafe: vi.fn(),
  },
}));

const BILLING_CLIENT_ID = "clbillingclient0000000001";

function createBillingClientFixture(
  overrides: Partial<BillingClient> = {},
): BillingClient {
  return {
    id: BILLING_CLIENT_ID,
    code: "GOMEZ-00001",
    codeNumber: 1,
    name: "GOMEZ SRL",
    address: null,
    city: null,
    province: null,
    email: null,
    whatsapp: null,
    identificationType: "NINGUNO",
    identificationNumber: null,
    ivaCondition: "CONSUMIDOR_FINAL",
    notes: null,
    createdAt: new Date("2026-08-01T12:00:00Z"),
    updatedAt: new Date("2026-08-01T12:00:00Z"),
    ...overrides,
  };
}

describe("BillingClientService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    vi.mocked(billingClientRepository.getNextCodeNumber).mockResolvedValue(1);
    vi.mocked(billingClientRepository.isUniqueConstraintError).mockReturnValue(
      false,
    );
    vi.mocked(billingClientRepository.findById).mockResolvedValue(
      createBillingClientFixture(),
    );
    vi.mocked(billingClientRepository.findByCode).mockResolvedValue(null);
    vi.mocked(billingClientRepository.findByIdentification).mockResolvedValue(
      null,
    );
    vi.mocked(billingClientRepository.findCanonicalGeneric).mockResolvedValue(
      null,
    );
  });

  describe("createClient", () => {
    it("guarda el nombre en mayúsculas y genera el código automático", async () => {
      vi.mocked(billingClientRepository.create).mockImplementation(
        async (data) =>
          createBillingClientFixture({
            code: data.code,
            codeNumber: data.codeNumber,
            name: data.name,
          }),
      );

      const client = await billingClientService.createClient({
        name: "  gómez srl ",
        identificationType: "NINGUNO",
        ivaCondition: "CONSUMIDOR_FINAL",
      });

      expect(client.name).toBe("GÓMEZ SRL");
      expect(billingClientRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "GÓMEZ SRL",
          code: "GOMEZ-00001",
          codeNumber: 1,
        }),
      );
      expect(auditService.logOperationSafe).toHaveBeenCalledWith({
        userId: adminUserFixture.id,
        action: AUDIT_ACTIONS.BILLING_CLIENT_CREATED,
        entityType: AUDIT_ENTITY_TYPES.BILLING_CLIENT,
        entityId: client.id,
      });
    });

    it("normaliza el CUIT quitando guiones antes de guardar", async () => {
      vi.mocked(billingClientRepository.create).mockResolvedValue(
        createBillingClientFixture(),
      );

      await billingClientService.createClient({
        name: "Cliente",
        identificationType: "CUIT",
        identificationNumber: "30-50001091-2",
        ivaCondition: "RESPONSABLE_INSCRIPTO",
      });

      expect(billingClientRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          identificationType: "CUIT",
          identificationNumber: "30500010912",
          ivaCondition: "RESPONSABLE_INSCRIPTO",
        }),
      );
    });

    it("rechaza un CUIT con dígito verificador inválido", async () => {
      await expect(
        billingClientService.createClient({
          name: "Cliente",
          identificationType: "CUIT",
          identificationNumber: "30500010913",
          ivaCondition: "RESPONSABLE_INSCRIPTO",
        }),
      ).rejects.toMatchObject({ code: "INVALID_CUIT" });

      expect(billingClientRepository.create).not.toHaveBeenCalled();
    });

    it("rechaza un CUIT ya registrado en otro cliente", async () => {
      vi.mocked(billingClientRepository.findByIdentification).mockResolvedValue(
        createBillingClientFixture({ identificationNumber: "30500010912" }),
      );

      await expect(
        billingClientService.createClient({
          name: "Otro cliente",
          identificationType: "CUIT",
          identificationNumber: "30-50001091-2",
          ivaCondition: "RESPONSABLE_INSCRIPTO",
        }),
      ).rejects.toMatchObject({
        code: "DUPLICATE_CUIT",
        message: "Ya existe un cliente registrado con este CUIT.",
      });

      expect(billingClientRepository.create).not.toHaveBeenCalled();
    });

    it("rechaza condiciones de IVA distintas de Consumidor Final con DNI", async () => {
      await expect(
        billingClientService.createClient({
          name: "Cliente",
          identificationType: "DNI",
          identificationNumber: "12345678",
          ivaCondition: "MONOTRIBUTISTA",
        }),
      ).rejects.toMatchObject({ code: "INVALID_IVA_CONDITION" });
    });

    it("limpia el documento cuando el tipo es NINGUNO", async () => {
      vi.mocked(billingClientRepository.create).mockResolvedValue(
        createBillingClientFixture(),
      );

      await billingClientService.createClient({
        name: "Cliente genérico",
        identificationType: "NINGUNO",
        identificationNumber: "12345678",
        ivaCondition: "CONSUMIDOR_FINAL",
      });

      expect(billingClientRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          identificationType: "NINGUNO",
          identificationNumber: null,
        }),
      );
    });

    it("reintenta la generación de código ante un conflicto de unicidad", async () => {
      const uniqueError = new Error("unique");
      vi.mocked(billingClientRepository.getNextCodeNumber)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(8);
      vi.mocked(billingClientRepository.isUniqueConstraintError).mockReturnValue(
        true,
      );
      vi.mocked(billingClientRepository.create)
        .mockRejectedValueOnce(uniqueError)
        .mockResolvedValueOnce(
          createBillingClientFixture({ code: "CLIEN-0008", codeNumber: 8 }),
        );

      const client = await billingClientService.createClient({
        name: "Cliente",
        identificationType: "NINGUNO",
        ivaCondition: "CONSUMIDOR_FINAL",
      });

      expect(client.codeNumber).toBe(8);
      expect(billingClientRepository.create).toHaveBeenCalledTimes(2);
    });

    it("valida el email cuando se informa", async () => {
      await expect(
        billingClientService.createClient({
          name: "Cliente",
          email: "no-es-un-email",
          identificationType: "NINGUNO",
          ivaCondition: "CONSUMIDOR_FINAL",
        }),
      ).rejects.toBeInstanceOf(BillingClientError);
    });

    it("solo ADMIN puede crear clientes", async () => {
      mockRequireRoleForbidden();

      await expect(
        billingClientService.createClient({
          name: "Cliente",
          identificationType: "NINGUNO",
          ivaCondition: "CONSUMIDOR_FINAL",
        }),
      ).rejects.toBeInstanceOf(AuthForbiddenError);
    });
  });

  describe("ensureGenericClient", () => {
    it("devuelve el cliente canónico existente sin crear otro", async () => {
      const existing = createBillingClientFixture({
        name: "CLIENTE SIN IDENTIFICACIÓN",
      });
      vi.mocked(billingClientRepository.findCanonicalGeneric).mockResolvedValue(
        existing,
      );

      const client = await billingClientService.ensureGenericClient();

      expect(client).toBe(existing);
      expect(billingClientRepository.create).not.toHaveBeenCalled();
    });

    it("crea el cliente canónico si todavía no existe", async () => {
      vi.mocked(billingClientRepository.create).mockImplementation(
        async (data) =>
          createBillingClientFixture({
            code: data.code,
            codeNumber: data.codeNumber,
            name: data.name,
          }),
      );

      const client = await billingClientService.ensureGenericClient();

      expect(client.name).toBe("CLIENTE SIN IDENTIFICACIÓN");
      expect(billingClientRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "CLIENTE SIN IDENTIFICACIÓN",
          identificationType: "NINGUNO",
          identificationNumber: null,
          ivaCondition: "CONSUMIDOR_FINAL",
        }),
      );
    });
  });

  describe("updateClient", () => {
    it("actualiza los datos sin regenerar el código", async () => {
      vi.mocked(billingClientRepository.update).mockResolvedValue(
        createBillingClientFixture({ name: "NUEVO NOMBRE" }),
      );

      await billingClientService.updateClient({
        id: BILLING_CLIENT_ID,
        name: "nuevo nombre",
        identificationType: "NINGUNO",
        ivaCondition: "CONSUMIDOR_FINAL",
      });

      expect(billingClientRepository.update).toHaveBeenCalledWith(
        BILLING_CLIENT_ID,
        expect.objectContaining({ name: "NUEVO NOMBRE" }),
      );
      expect(billingClientRepository.update).toHaveBeenCalledWith(
        BILLING_CLIENT_ID,
        expect.not.objectContaining({ code: expect.anything() }),
      );
      expect(auditService.logOperationSafe).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.BILLING_CLIENT_UPDATED,
        }),
      );
    });

    it("actualiza el código de cliente si se envía", async () => {
      vi.mocked(billingClientRepository.update).mockResolvedValue(
        createBillingClientFixture({ code: "GLR-00002" }),
      );

      await billingClientService.updateClient({
        id: BILLING_CLIENT_ID,
        name: "GOMEZ SRL",
        code: "glr-2",
        identificationType: "NINGUNO",
        ivaCondition: "CONSUMIDOR_FINAL",
      });

      expect(billingClientRepository.update).toHaveBeenCalledWith(
        BILLING_CLIENT_ID,
        expect.objectContaining({ code: "GLR-00002" }),
      );
    });

    it("lanza BILLING_CLIENT_NOT_FOUND si el cliente no existe", async () => {
      vi.mocked(billingClientRepository.findById).mockResolvedValue(null);

      await expect(
        billingClientService.updateClient({
          id: "inexistente",
          name: "Cliente",
          identificationType: "NINGUNO",
          ivaCondition: "CONSUMIDOR_FINAL",
        }),
      ).rejects.toMatchObject({ code: "BILLING_CLIENT_NOT_FOUND" });
    });
  });

  describe("deleteClient", () => {
    it("elimina y audita", async () => {
      vi.mocked(billingClientRepository.delete).mockResolvedValue(
        createBillingClientFixture(),
      );

      await billingClientService.deleteClient(BILLING_CLIENT_ID);

      expect(billingClientRepository.delete).toHaveBeenCalledWith(
        BILLING_CLIENT_ID,
      );
      expect(auditService.logOperationSafe).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.BILLING_CLIENT_DELETED,
        }),
      );
    });
  });
});
