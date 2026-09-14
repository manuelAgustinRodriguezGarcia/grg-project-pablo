import type { BillingFiscalSettings } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export const BILLING_FISCAL_SETTINGS_ID = "fiscal-settings";

export class BillingFiscalSettingsRepository {
  /**
   * Devuelve el registro único de configuración fiscal, creándolo con los
   * valores por defecto del schema (IVA 21%, límite $400.000, PV 0007,
   * ambiente modo prueba) si todavía no existe.
   */
  async getOrCreate(): Promise<BillingFiscalSettings> {
    return prisma.billingFiscalSettings.upsert({
      where: { id: BILLING_FISCAL_SETTINGS_ID },
      create: { id: BILLING_FISCAL_SETTINGS_ID },
      update: {},
    });
  }

  async update(data: {
    ivaPercent?: Prisma.Decimal;
    genericClientLimit?: Prisma.Decimal;
  }): Promise<BillingFiscalSettings> {
    return prisma.billingFiscalSettings.update({
      where: { id: BILLING_FISCAL_SETTINGS_ID },
      data,
    });
  }
}

export const billingFiscalSettingsRepository =
  new BillingFiscalSettingsRepository();
