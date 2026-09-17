import type { Metadata } from "next";
import { getBillingFiscalSettingsAction } from "@/features/billing/actions/billing-fiscal-settings.actions";
import { FiscalSettingsManager } from "@/features/billing/components/settings/FiscalSettingsManager";
import type { BillingFiscalContext } from "@/features/billing/types/billing-invoice.types";
import { requireAdminOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Configuración fiscal",
};

const FALLBACK_FISCAL_CONTEXT: BillingFiscalContext = {
  ivaPercent: 21,
  genericClientLimit: 400_000,
  pointOfSale: "0007",
  environment: "MODO_PRUEBA",
};

export default async function FacturacionConfiguracionFiscalPage() {
  await requireAdminOrRedirect("/admin");
  const settingsResult = await getBillingFiscalSettingsAction();

  return (
    <FiscalSettingsManager
      initialSettings={
        settingsResult.success ? settingsResult.data : FALLBACK_FISCAL_CONTEXT
      }
    />
  );
}
