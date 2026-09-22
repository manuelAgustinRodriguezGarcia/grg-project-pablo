import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingRubro } from "@/generated/prisma/client";
import { AuthForbiddenError } from "@/server/auth/errors";
import { billingRubroRepository } from "@/server/repositories/billing-rubro.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { billingRubroService } from "@/server/services/billing-rubro.service";
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
  requirePermission: vi.fn(),
  requireAnyPermission: vi.fn(),
}));
vi.mock("@/server/repositories/billing-rubro.repository", () => ({
  billingRubroRepository: {
    findAllOrdered: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    findByCode: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getNextCodeNumber: vi.fn(),
    isUniqueConstraintError: vi.fn(),
    isUniqueNameError: vi.fn(),
    isUniqueCodeError: vi.fn(),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperation: vi.fn(),
    logOperationSafe: vi.fn(),
  },
}));

const BILLING_RUBRO_ID = "clbillingrubro00000000001";

function createBillingRubroFixture(
  overrides: Partial<BillingRubro> = {},
): BillingRubro {
  return {
    id: BILLING_RUBRO_ID,
    code: "EMBRA-0001",
    codeNumber: 1,
    name: "Embragues",
    description: null,
    status: "ACTIVE",
    createdAt: new Date("2026-08-01T12:00:00Z"),
    updatedAt: new Date("2026-08-01T12:00:00Z"),
    ...overrides,
  };
}

describe("BillingRubroService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    vi.mocked(billingRubroRepository.getNextCodeNumber).mockResolvedValue(1);
    vi.mocked(billingRubroRepository.isUniqueConstraintError).mockReturnValue(
      false,
    );
    vi.mocked(billingRubroRepository.isUniqueNameError).mockReturnValue(false);
    vi.mocked(billingRubroRepository.isUniqueCodeError).mockReturnValue(false);
    vi.mocked(billingRubroRepository.findByName).mockResolvedValue(null);
    vi.mocked(billingRubroRepository.findByCode).mockResolvedValue(null);
    vi.mocked(billingRubroRepository.findById).mockResolvedValue(
      createBillingRubroFixture(),
    );
  });

  describe("createRubro", () => {
    it("genera el código automático y audita la creación", async () => {
      vi.mocked(billingRubroRepository.create).mockImplementation(
        async (data) =>
          createBillingRubroFixture({
            code: data.code,
            codeNumber: data.codeNumber,
            name: data.name,
          }),
      );

      const rubro = await billingRubroService.createRubro({
        name: "  Embragues ",
      });

      expect(rubro.name).toBe("Embragues");
      expect(billingRubroRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Embragues",
          code: "EMBRA-0001",
          codeNumber: 1,
          status: "ACTIVE",
        }),
      );
      expect(auditService.logOperationSafe).toHaveBeenCalledWith({
        userId: adminUserFixture.id,
        action: AUDIT_ACTIONS.BILLING_RUBRO_CREATED,
        entityType: AUDIT_ENTITY_TYPES.BILLING_RUBRO,
        entityId: rubro.id,
      });
    });

    it("rechaza nombres vacíos", async () => {
      await expect(
        billingRubroService.createRubro({ name: "   " }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

      expect(billingRubroRepository.create).not.toHaveBeenCalled();
    });

    it("rechaza nombres duplicados sin importar mayúsculas", async () => {
      vi.mocked(billingRubroRepository.findByName).mockResolvedValue(
        createBillingRubroFixture({ name: "Embragues" }),
      );

      await expect(
        billingRubroService.createRubro({ name: "EMBRAGUES" }),
      ).rejects.toMatchObject({ code: "DUPLICATE_NAME" });

      expect(billingRubroRepository.create).not.toHaveBeenCalled();
    });

    it("normaliza la descripción vacía a null", async () => {
      vi.mocked(billingRubroRepository.create).mockResolvedValue(
        createBillingRubroFixture(),
      );

      await billingRubroService.createRubro({
        name: "Filtros",
        description: "   ",
      });

      expect(billingRubroRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      );
    });

    it("usa el código personalizado cuando se envía", async () => {
      vi.mocked(billingRubroRepository.create).mockImplementation(
        async (data) =>
          createBillingRubroFixture({
            code: data.code,
            codeNumber: data.codeNumber,
            name: data.name,
          }),
      );

      const rubro = await billingRubroService.createRubro({
        name: "Alternadores",
        code: " alt-99 ",
      });

      expect(rubro.code).toBe("ALT-99");
      expect(billingRubroRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Alternadores",
          code: "ALT-99",
        }),
      );
    });

    it("rechaza un código duplicado", async () => {
      vi.mocked(billingRubroRepository.findByCode).mockResolvedValue(
        createBillingRubroFixture({ code: "ALTER-0003" }),
      );

      await expect(
        billingRubroService.createRubro({
          name: "Otro",
          code: "ALTER-0003",
        }),
      ).rejects.toMatchObject({ code: "DUPLICATE_CODE" });

      expect(billingRubroRepository.create).not.toHaveBeenCalled();
    });

    it("reintenta la generación de código ante un conflicto de unicidad", async () => {
      const uniqueError = new Error("unique");
      vi.mocked(billingRubroRepository.getNextCodeNumber)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(8);
      vi.mocked(billingRubroRepository.isUniqueConstraintError).mockReturnValue(
        true,
      );
      vi.mocked(billingRubroRepository.create)
        .mockRejectedValueOnce(uniqueError)
        .mockResolvedValueOnce(
          createBillingRubroFixture({ code: "FRENO-0008", codeNumber: 8 }),
        );

      const rubro = await billingRubroService.createRubro({ name: "Frenos" });

      expect(rubro.codeNumber).toBe(8);
      expect(billingRubroRepository.create).toHaveBeenCalledTimes(2);
    });

    it("solo ADMIN puede crear rubros", async () => {
      mockRequireRoleForbidden();

      await expect(
        billingRubroService.createRubro({ name: "Embragues" }),
      ).rejects.toBeInstanceOf(AuthForbiddenError);
    });
  });

  describe("updateRubro", () => {
    it("actualiza los datos sin regenerar el código", async () => {
      vi.mocked(billingRubroRepository.update).mockResolvedValue(
        createBillingRubroFixture({ name: "Frenos", status: "INACTIVE" }),
      );

      await billingRubroService.updateRubro({
        id: BILLING_RUBRO_ID,
        name: "Frenos",
        status: "INACTIVE",
      });

      expect(billingRubroRepository.update).toHaveBeenCalledWith(
        BILLING_RUBRO_ID,
        expect.objectContaining({ name: "Frenos", status: "INACTIVE" }),
      );
      expect(billingRubroRepository.update).toHaveBeenCalledWith(
        BILLING_RUBRO_ID,
        expect.not.objectContaining({ code: expect.anything() }),
      );
      expect(auditService.logOperationSafe).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.BILLING_RUBRO_UPDATED,
        }),
      );
    });

    it("actualiza el código si se envía uno nuevo y único", async () => {
      vi.mocked(billingRubroRepository.update).mockResolvedValue(
        createBillingRubroFixture({ code: "FRENO-0009" }),
      );

      await billingRubroService.updateRubro({
        id: BILLING_RUBRO_ID,
        name: "Embragues",
        code: "FRENO-0009",
      });

      expect(billingRubroRepository.update).toHaveBeenCalledWith(
        BILLING_RUBRO_ID,
        expect.objectContaining({ code: "FRENO-0009", name: "Embragues" }),
      );
    });

    it("conserva el estado actual si no se envía en la edición", async () => {
      vi.mocked(billingRubroRepository.findById).mockResolvedValue(
        createBillingRubroFixture({ status: "INACTIVE" }),
      );
      vi.mocked(billingRubroRepository.update).mockResolvedValue(
        createBillingRubroFixture({ status: "INACTIVE" }),
      );

      await billingRubroService.updateRubro({
        id: BILLING_RUBRO_ID,
        name: "Embragues",
      });

      expect(billingRubroRepository.update).toHaveBeenCalledWith(
        BILLING_RUBRO_ID,
        expect.objectContaining({ status: "INACTIVE" }),
      );
    });

    it("rechaza el código si pertenece a otro rubro", async () => {
      vi.mocked(billingRubroRepository.findByCode).mockResolvedValue(
        createBillingRubroFixture({ id: "otro-rubro", code: "ALTER-0003" }),
      );

      await expect(
        billingRubroService.updateRubro({
          id: BILLING_RUBRO_ID,
          name: "Embragues",
          code: "ALTER-0003",
        }),
      ).rejects.toMatchObject({ code: "DUPLICATE_CODE" });
    });

    it("permite conservar el mismo nombre del rubro editado", async () => {
      vi.mocked(billingRubroRepository.findByName).mockResolvedValue(
        createBillingRubroFixture(),
      );
      vi.mocked(billingRubroRepository.update).mockResolvedValue(
        createBillingRubroFixture(),
      );

      await expect(
        billingRubroService.updateRubro({
          id: BILLING_RUBRO_ID,
          name: "Embragues",
        }),
      ).resolves.toMatchObject({ id: BILLING_RUBRO_ID });
    });

    it("rechaza el nombre si pertenece a otro rubro", async () => {
      vi.mocked(billingRubroRepository.findByName).mockResolvedValue(
        createBillingRubroFixture({ id: "otro-rubro" }),
      );

      await expect(
        billingRubroService.updateRubro({
          id: BILLING_RUBRO_ID,
          name: "Embragues",
        }),
      ).rejects.toMatchObject({ code: "DUPLICATE_NAME" });
    });

    it("lanza BILLING_RUBRO_NOT_FOUND si el rubro no existe", async () => {
      vi.mocked(billingRubroRepository.findById).mockResolvedValue(null);

      await expect(
        billingRubroService.updateRubro({
          id: "inexistente",
          name: "Rubro",
        }),
      ).rejects.toMatchObject({ code: "BILLING_RUBRO_NOT_FOUND" });
    });
  });

  describe("deleteRubro", () => {
    it("elimina y audita", async () => {
      vi.mocked(billingRubroRepository.delete).mockResolvedValue(
        createBillingRubroFixture(),
      );

      await billingRubroService.deleteRubro(BILLING_RUBRO_ID);

      expect(billingRubroRepository.delete).toHaveBeenCalledWith(
        BILLING_RUBRO_ID,
      );
      expect(auditService.logOperationSafe).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.BILLING_RUBRO_DELETED,
        }),
      );
    });
  });
});
