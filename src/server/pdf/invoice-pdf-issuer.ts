import type { BillingFiscalSettings } from "@/generated/prisma/client";
import type { InvoicePdfIssuer } from "@/server/pdf/invoice-pdf.types";

/** Placeholders visibles hasta que Pablo cargue los datos reales. */
export const DEFAULT_PDF_ISSUER: InvoicePdfIssuer = {
  name: "Rothamel Repuestos S.H",
  cuit: "XX-XXXXXXXX-X",
  address: "Calle XXXXX",
  city: "Pampa del Infierno",
  province: "Chaco",
  ivaCondition: null,
  grossIncome: "XXXXXXXX",
  activitiesStartedAt: "DD/MM/AAAA",
};

export function resolveInvoicePdfIssuer(
  settings: BillingFiscalSettings,
): InvoicePdfIssuer {
  return {
    name: settings.issuerName?.trim() || DEFAULT_PDF_ISSUER.name,
    cuit: settings.issuerCuit?.trim() || DEFAULT_PDF_ISSUER.cuit,
    address: settings.issuerAddress?.trim() || DEFAULT_PDF_ISSUER.address,
    city: settings.issuerCity?.trim() || DEFAULT_PDF_ISSUER.city,
    province: settings.issuerProvince?.trim() || DEFAULT_PDF_ISSUER.province,
    ivaCondition:
      settings.issuerIvaCondition?.trim() || DEFAULT_PDF_ISSUER.ivaCondition,
    grossIncome:
      settings.issuerGrossIncome?.trim() || DEFAULT_PDF_ISSUER.grossIncome,
    activitiesStartedAt:
      settings.issuerActivitiesStartedAt?.trim() ||
      DEFAULT_PDF_ISSUER.activitiesStartedAt,
  };
}

export function issuerIdentityLines(issuer: InvoicePdfIssuer): string[] {
  return [issuer.name, issuer.address, issuerLocationLine(issuer)].filter(
    (line): line is string => Boolean(line),
  );
}

export function issuerLocationLine(issuer: InvoicePdfIssuer): string {
  const city = (issuer.city ?? DEFAULT_PDF_ISSUER.city ?? "").toLocaleUpperCase(
    "es-AR",
  );
  const province = (
    issuer.province ??
    DEFAULT_PDF_ISSUER.province ??
    ""
  ).toLocaleUpperCase("es-AR");
  return `${city}, ${province}`;
}

export function issuerFiscalLines(issuer: InvoicePdfIssuer): string[] {
  return [
    `CUIT: ${issuer.cuit ?? DEFAULT_PDF_ISSUER.cuit}`,
    `Ingresos Brutos: ${issuer.grossIncome ?? DEFAULT_PDF_ISSUER.grossIncome}`,
    `Inicio de actividades: ${issuer.activitiesStartedAt ?? DEFAULT_PDF_ISSUER.activitiesStartedAt}`,
  ];
}
