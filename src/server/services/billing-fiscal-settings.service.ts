import { Prisma } from "@/generated/prisma/client";
import type { BillingFiscalSettings } from "@/generated/prisma/client";
import { requireAdmin } from "@/server/auth";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import {
  isValidGenericClientLimit,
  isValidIvaPercent,
  roundToTwoDecimals,
} from "@/features/billing/utils/fiscal-settings";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { BillingFiscalSettingsError } from "./billing-fiscal-settings.errors";

export type UpdateBillingFiscalSettingsInput =
  | { ivaPercent: number }
  | { genericClientLimit: number };

export class BillingFiscalSettingsService {
  async getSettings(): Promise<BillingFiscalSettings> {
    await requireAdmin();
    return billingFiscalSettingsRepository.getOrCreate();
  }

  async updateSettings(
    input: UpdateBillingFiscalSettingsInput,
  ): Promise<BillingFiscalSettings> {
    const { profile: admin } = await requireAdmin();
    const current = await billingFiscalSettingsRepository.getOrCreate();

    if ("ivaPercent" in input) {
      const ivaPercent = roundToTwoDecimals(input.ivaPercent);
      if (!isValidIvaPercent(ivaPercent)) {
        throw new BillingFiscalSettingsError(
          "El IVA debe estar entre 0% y 100%.",
          "VALIDATION_ERROR",
        );
      }

      if (current.ivaPercent.toNumber() === ivaPercent) {
        return current;
      }

      const updated = await billingFiscalSettingsRepository.update({
        ivaPercent: new Prisma.Decimal(ivaPercent.toFixed(2)),
      });

      auditService.logOperationSafe({
        userId: admin.id,
        action: AUDIT_ACTIONS.BILLING_IVA_UPDATED,
        entityType: AUDIT_ENTITY_TYPES.BILLING_FISCAL_SETTINGS,
        entityId: updated.id,
      });

      return updated;
    }

    if ("genericClientLimit" in input) {
      const genericClientLimit = roundToTwoDecimals(input.genericClientLimit);
      if (!isValidGenericClientLimit(genericClientLimit)) {
        throw new BillingFiscalSettingsError(
          "El límite de cliente genérico no es válido.",
          "VALIDATION_ERROR",
        );
      }

      if (current.genericClientLimit.toNumber() === genericClientLimit) {
        return current;
      }

      const updated = await billingFiscalSettingsRepository.update({
        genericClientLimit: new Prisma.Decimal(genericClientLimit.toFixed(2)),
      });

      auditService.logOperationSafe({
        userId: admin.id,
        action: AUDIT_ACTIONS.BILLING_GENERIC_LIMIT_UPDATED,
        entityType: AUDIT_ENTITY_TYPES.BILLING_FISCAL_SETTINGS,
        entityId: updated.id,
      });

      return updated;
    }

    const _exhaustive: never = input;
    throw new Error(`Unhandled fiscal settings update: ${_exhaustive}`);
  }
}

export const billingFiscalSettingsService = new BillingFiscalSettingsService();
