import { formatActivitiesStartedAt } from "@/features/billing/utils/issuer-fiscal-configuration";
import type { BillingFiscalSettings } from "@/generated/prisma/client";
import type { InvoicePdfIssuer } from "@/server/pdf/invoice-pdf.types";
import { formatCuit, isValidCuit } from "@/shared/utils/identification";

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

/** Datos reales del emisor. Los campos vacíos quedan vacíos. */
export function resolveStoredInvoicePdfIssuer(
  settings: BillingFiscalSettings,
): InvoicePdfIssuer {
  return {
    name: settings.issuerName?.trim() || "",
    cuit: settings.issuerCuit?.trim() || null,
    address: settings.issuerAddress?.trim() || null,
    city: settings.issuerCity?.trim() || null,
    province: settings.issuerProvince?.trim() || null,
    ivaCondition: settings.issuerIvaCondition?.trim() || null,
    grossIncome: settings.issuerGrossIncome?.trim() || null,
    activitiesStartedAt: settings.issuerActivitiesStartedAt?.trim() || null,
  };
}

export function issuerIdentityLines(
  issuer: InvoicePdfIssuer,
  usePlaceholders = true,
): string[] {
  return [
    issuer.name.trim() || (usePlaceholders ? DEFAULT_PDF_ISSUER.name : ""),
    issuer.address,
    issuerLocationLine(issuer, usePlaceholders),
  ].filter((line): line is string => Boolean(line?.trim()));
}

export function issuerLocationLine(
  issuer: InvoicePdfIssuer,
  usePlaceholders = true,
): string {
  const city = (
    issuer.city?.trim() ||
    (usePlaceholders ? DEFAULT_PDF_ISSUER.city : "") ||
    ""
  ).toLocaleUpperCase("es-AR");
  const province = (
    issuer.province?.trim() ||
    (usePlaceholders ? DEFAULT_PDF_ISSUER.province : "") ||
    ""
  ).toLocaleUpperCase("es-AR");

  return [city, province].filter(Boolean).join(", ");
}

export function issuerFiscalLines(
  issuer: InvoicePdfIssuer,
  usePlaceholders = true,
): string[] {
  const rawCuit =
    issuer.cuit?.trim() || (usePlaceholders ? DEFAULT_PDF_ISSUER.cuit : "");
  const cuit = rawCuit && isValidCuit(rawCuit) ? formatCuit(rawCuit) : rawCuit;
  const grossIncome =
    issuer.grossIncome?.trim() ||
    (usePlaceholders ? DEFAULT_PDF_ISSUER.grossIncome : "");
  const rawStartedAt =
    issuer.activitiesStartedAt?.trim() ||
    (usePlaceholders ? DEFAULT_PDF_ISSUER.activitiesStartedAt : "");
  const startedAt = rawStartedAt
    ? formatActivitiesStartedAt(rawStartedAt)
    : "";

  return [
    cuit ? `CUIT: ${cuit}` : "",
    grossIncome ? `Ingresos Brutos: ${grossIncome}` : "",
    startedAt ? `Inicio de actividades: ${startedAt}` : "",
  ].filter(Boolean);
}
