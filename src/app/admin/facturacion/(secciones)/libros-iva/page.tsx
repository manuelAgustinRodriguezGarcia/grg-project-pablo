import type { Metadata } from "next";
import { LibroIvaResumenesManager } from "@/features/billing/components/invoices/LibroIvaResumenesManager";
import { LIBRO_IVA_RESUMENES_TITLE } from "@/features/billing/utils/libro-iva-resumenes";
import { requireBillingStatisticsAndLibrosOrRedirect } from "@/server/auth";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";

export const metadata: Metadata = {
  title: LIBRO_IVA_RESUMENES_TITLE,
};

export default async function LibrosIvaPage() {
  await requireBillingStatisticsAndLibrosOrRedirect("invoices.read", "/admin");
  const settings = await billingFiscalSettingsRepository.getOrCreate();

  return <LibroIvaResumenesManager initialEnvironment={settings.environment} />;
}
