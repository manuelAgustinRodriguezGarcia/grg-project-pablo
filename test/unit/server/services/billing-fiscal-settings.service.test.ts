import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingFiscalSettings } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { AuthForbiddenError } from "@/server/auth/errors";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
} from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { billingFiscalSettingsService } from "@/server/services/billing-fiscal-settings.service";
import { BillingFiscalSettingsError } from "@/server/services/billing-fiscal-settings.errors";
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
vi.mock("@/server/repositories/billing-fiscal-settings.repository", () => ({
  billingFiscalSettingsRepository: {
    getOrCreate: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperation: vi.fn(),
    logOperationSafe: vi.fn(),
  },
}));

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

describe("BillingFiscalSettingsService.updateSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole();
  });

  it("actualiza el IVA y registra auditoría", async () => {
    const current = createSettingsFixture();
    const updated = createSettingsFixture({
      ivaPercent: new Prisma.Decimal("10.5"),
    });
    vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
      current,
    );
    vi.mocked(billingFiscalSettingsRepository.update).mockResolvedValue(
      updated,
    );

    const result = await billingFiscalSettingsService.updateSettings({
      ivaPercent: 10.5,
    });

    expect(result.ivaPercent.toNumber()).toBe(10.5);
    expect(billingFiscalSettingsRepository.update).toHaveBeenCalledTimes(1);
    expect(auditService.logOperationSafe).toHaveBeenCalledWith({
      userId: adminUserFixture.id,
      action: AUDIT_ACTIONS.BILLING_IVA_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.BILLING_FISCAL_SETTINGS,
      entityId: "fiscal-settings",
    });
  });

  it("no escribe si el límite no cambió", async () => {
    vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
      createSettingsFixture(),
    );

    const result = await billingFiscalSettingsService.updateSettings({
      genericClientLimit: 400_000,
    });

    expect(result.genericClientLimit.toNumber()).toBe(400_000);
    expect(billingFiscalSettingsRepository.update).not.toHaveBeenCalled();
    expect(auditService.logOperationSafe).not.toHaveBeenCalled();
  });

  it("rechaza un IVA fuera de rango", async () => {
    vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue(
      createSettingsFixture(),
    );

    await expect(
      billingFiscalSettingsService.updateSettings({ ivaPercent: 140 }),
    ).rejects.toBeInstanceOf(BillingFiscalSettingsError);
    expect(billingFiscalSettingsRepository.update).not.toHaveBeenCalled();
  });

  it("solo ADMIN puede editar", async () => {
    mockRequireRoleForbidden();

    await expect(
      billingFiscalSettingsService.updateSettings({ ivaPercent: 21 }),
    ).rejects.toBeInstanceOf(AuthForbiddenError);
  });
});
