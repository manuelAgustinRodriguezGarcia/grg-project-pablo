import type { Metadata } from "next";
import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import { StatisticsManager } from "@/features/billing/components/statistics/StatisticsManager";
import { parseStatisticsNavigation } from "@/features/billing/utils/billing-statistics-navigation";
import { requireBillingSectionPreviewOrRedirect } from "@/server/auth";
import { readActiveFiscalEnvironment } from "@/server/services/billing-fiscal-scope";

export const metadata: Metadata = {
  title: "Estadísticas",
};

type FacturacionEstadisticasPageProps = {
  searchParams: Promise<{
    seccion?: string | string[];
    analisis?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function FacturacionEstadisticasPage({
  searchParams,
}: FacturacionEstadisticasPageProps) {
  await requireBillingSectionPreviewOrRedirect("statistics.read", "/admin");
  const params = await searchParams;
  const navigation = parseStatisticsNavigation(
    firstParam(params.seccion),
    firstParam(params.analisis),
  );

  let fiscalEnvironment: BillingFiscalEnvironment;
  try {
    fiscalEnvironment = await readActiveFiscalEnvironment();
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "La configuración fiscal no está disponible.";
    return <p role="alert">{message}</p>;
  }

  const today = new Date();

  return (
    <StatisticsManager
      fiscalEnvironment={fiscalEnvironment}
      initialYear={today.getFullYear()}
      initialMonth={today.getMonth() + 1}
      initialSection={navigation.section}
      initialAnalysis={navigation.analysis}
    />
  );
}
