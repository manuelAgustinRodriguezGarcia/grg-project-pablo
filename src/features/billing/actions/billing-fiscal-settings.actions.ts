"use server";

import { AuthError } from "@/server/auth";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";
import { isArcaProductionEmissionEnabled } from "@/server/arca/config/production-emission";
import { billingFiscalSettingsService } from "@/server/services/billing-fiscal-settings.service";
import { BillingFiscalSettingsError } from "@/server/services/billing-fiscal-settings.errors";
import {
  updateGenericClientLimitSchema,
  updateIssuerFiscalSettingsSchema,
  updateIvaPercentSchema,
} from "@/features/billing/schemas/billing-fiscal-settings.schemas";
import type {
  BillingFiscalContext,
  BillingInvoiceActionResult,
} from "@/features/billing/types/billing-invoice.types";

function toFiscalContext(
  settings: Awaited<ReturnType<typeof billingFiscalSettingsService.getSettings>>,
): BillingFiscalContext {
  return {
    ivaPercent: settings.ivaPercent.toNumber(),
    genericClientLimit: settings.genericClientLimit.toNumber(),
    pointOfSale: settings.pointOfSale,
    environment: settings.environment,
    issuerName: settings.issuerName,
    issuerCuit: settings.issuerCuit,
    issuerAddress: settings.issuerAddress,
    issuerCity: settings.issuerCity,
    issuerProvince: settings.issuerProvince,
    issuerIvaCondition: settings.issuerIvaCondition,
    issuerGrossIncome: settings.issuerGrossIncome,
    issuerActivitiesStartedAt: settings.issuerActivitiesStartedAt,
    productionEmissionEnabled: isArcaProductionEmissionEnabled(),
  };
}

function toActionError(error: unknown): BillingInvoiceActionResult<never> {
  if (error instanceof BillingFiscalSettingsError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  console.error("[billingFiscalSettingsAction]", error);

  if (error instanceof Error) {
    return { success: false, error: getSafeClientMessage(error) };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function getBillingFiscalSettingsAction(): Promise<
  BillingInvoiceActionResult<BillingFiscalContext>
> {
  try {
    const settings = await billingFiscalSettingsService.getSettings();
    return { success: true, data: toFiscalContext(settings) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateBillingIvaPercentAction(
  input: unknown,
): Promise<BillingInvoiceActionResult<BillingFiscalContext>> {
  const parsed = updateIvaPercentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const settings = await billingFiscalSettingsService.updateSettings({
      ivaPercent: parsed.data.ivaPercent,
    });
    return { success: true, data: toFiscalContext(settings) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateBillingGenericClientLimitAction(
  input: unknown,
): Promise<BillingInvoiceActionResult<BillingFiscalContext>> {
  const parsed = updateGenericClientLimitSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const settings = await billingFiscalSettingsService.updateSettings({
      genericClientLimit: parsed.data.genericClientLimit,
    });
    return { success: true, data: toFiscalContext(settings) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateBillingIssuerFiscalSettingsAction(
  input: unknown,
): Promise<BillingInvoiceActionResult<BillingFiscalContext>> {
  const parsed = updateIssuerFiscalSettingsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const settings = await billingFiscalSettingsService.updateSettings({
      issuer: parsed.data,
    });
    return { success: true, data: toFiscalContext(settings) };
  } catch (error) {
    return toActionError(error);
  }
}
