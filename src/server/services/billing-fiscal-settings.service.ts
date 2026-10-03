import { Prisma } from "@/generated/prisma/client";
import type { BillingFiscalSettings } from "@/generated/prisma/client";
import { requireAnyPermission, requirePermission } from "@/server/auth";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import { parseActivitiesStartedAt } from "@/features/billing/utils/issuer-fiscal-configuration";
import {
  isValidGenericClientLimit,
  isValidIvaPercent,
  roundToTwoDecimals,
} from "@/features/billing/utils/fiscal-settings";
import type { UpdateIssuerFiscalSettingsInput } from "@/features/billing/schemas/billing-fiscal-settings.schemas";
import {
  isValidCuit,
  normalizeIdentificationDigits,
} from "@/shared/utils/identification";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { BillingFiscalSettingsError } from "./billing-fiscal-settings.errors";

export type UpdateBillingFiscalSettingsInput =
  | { ivaPercent: number }
  | { genericClientLimit: number }
  | { issuer: UpdateIssuerFiscalSettingsInput };

export class BillingFiscalSettingsService {
  async getSettings(): Promise<BillingFiscalSettings> {
    await requireAnyPermission(["settings.read", "invoices.create"]);
    return billingFiscalSettingsRepository.getOrCreate();
  }

  async updateSettings(
    input: UpdateBillingFiscalSettingsInput,
  ): Promise<BillingFiscalSettings> {
    const { profile: admin } = await requirePermission("settings.update");
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

    if ("issuer" in input) {
      const issuer = normalizeIssuerSettings(input.issuer);
      const unchanged =
        current.issuerName === issuer.issuerName &&
        current.issuerCuit === issuer.issuerCuit &&
        current.issuerAddress === issuer.issuerAddress &&
        current.issuerCity === issuer.issuerCity &&
        current.issuerProvince === issuer.issuerProvince &&
        current.issuerIvaCondition === issuer.issuerIvaCondition &&
        current.issuerGrossIncome === issuer.issuerGrossIncome &&
        current.issuerActivitiesStartedAt === issuer.issuerActivitiesStartedAt;

      if (unchanged) {
        return current;
      }

      const updated = await billingFiscalSettingsRepository.update(issuer);

      auditService.logOperationSafe({
        userId: admin.id,
        action: AUDIT_ACTIONS.BILLING_ISSUER_UPDATED,
        entityType: AUDIT_ENTITY_TYPES.BILLING_FISCAL_SETTINGS,
        entityId: updated.id,
      });

      return updated;
    }

    const _exhaustive: never = input;
    throw new Error(`Unhandled fiscal settings update: ${_exhaustive}`);
  }
}

function requireIssuerText(value: string, message: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new BillingFiscalSettingsError(message, "VALIDATION_ERROR");
  }

  return trimmed;
}

function normalizeIssuerSettings(
  input: UpdateIssuerFiscalSettingsInput,
): UpdateIssuerFiscalSettingsInput {
  if (!isValidCuit(input.issuerCuit)) {
    throw new BillingFiscalSettingsError(
      "El CUIT del emisor no es válido.",
      "VALIDATION_ERROR",
    );
  }

  const issuerActivitiesStartedAt = parseActivitiesStartedAt(
    input.issuerActivitiesStartedAt,
  );

  if (!issuerActivitiesStartedAt) {
    throw new BillingFiscalSettingsError(
      "La fecha de inicio de actividades no es válida.",
      "VALIDATION_ERROR",
    );
  }

  return {
    issuerName: requireIssuerText(
      input.issuerName,
      "La razón social es obligatoria.",
    ),
    issuerCuit: normalizeIdentificationDigits(input.issuerCuit),
    issuerAddress: requireIssuerText(
      input.issuerAddress,
      "El domicilio comercial es obligatorio.",
    ),
    issuerCity: requireIssuerText(
      input.issuerCity,
      "La localidad es obligatoria.",
    ),
    issuerProvince: requireIssuerText(
      input.issuerProvince,
      "La provincia es obligatoria.",
    ),
    issuerIvaCondition: requireIssuerText(
      input.issuerIvaCondition,
      "La condición frente al IVA es obligatoria.",
    ),
    issuerGrossIncome: requireIssuerText(
      input.issuerGrossIncome,
      "Los ingresos brutos son obligatorios.",
    ),
    issuerActivitiesStartedAt,
  };
}

export const billingFiscalSettingsService = new BillingFiscalSettingsService();
