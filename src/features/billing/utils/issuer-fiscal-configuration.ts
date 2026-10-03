import { isValidCuit } from "@/shared/utils/identification";

export const ISSUER_FISCAL_FIELDS = [
  "issuerName",
  "issuerCuit",
  "issuerAddress",
  "issuerCity",
  "issuerProvince",
  "issuerIvaCondition",
  "issuerGrossIncome",
  "issuerActivitiesStartedAt",
  "pointOfSale",
] as const;

export type IssuerFiscalField = (typeof ISSUER_FISCAL_FIELDS)[number];

export type IssuerFiscalConfigurationInput = Record<
  IssuerFiscalField,
  string | null | undefined
>;

export const ISSUER_FISCAL_FIELD_LABELS: Record<IssuerFiscalField, string> = {
  issuerName: "Razón social",
  issuerCuit: "CUIT",
  issuerAddress: "Domicilio comercial",
  issuerCity: "Localidad",
  issuerProvince: "Provincia",
  issuerIvaCondition: "Condición frente al IVA",
  issuerGrossIncome: "Ingresos Brutos",
  issuerActivitiesStartedAt: "Inicio de actividades",
  pointOfSale: "Punto de venta",
};

export const EMPTY_ISSUER_FISCAL_FIELDS: Record<
  Exclude<IssuerFiscalField, "pointOfSale">,
  null
> = {
  issuerName: null,
  issuerCuit: null,
  issuerAddress: null,
  issuerCity: null,
  issuerProvince: null,
  issuerIvaCondition: null,
  issuerGrossIncome: null,
  issuerActivitiesStartedAt: null,
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const AR_DATE = /^(\d{2})[/-](\d{2})[/-](\d{4})$/;

export function parseActivitiesStartedAt(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? "";
  const iso = ISO_DATE.exec(trimmed);
  const argentine = AR_DATE.exec(trimmed);

  if (!iso && !argentine) {
    return null;
  }

  const year = Number(iso ? iso[1] : argentine?.[3]);
  const month = Number(iso ? iso[2] : argentine?.[2]);
  const day = Number(iso ? iso[3] : argentine?.[1]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${year}-${paddedMonth}-${paddedDay}`;
}

export function formatActivitiesStartedAt(
  value: string | null | undefined,
): string {
  const iso = parseActivitiesStartedAt(value);

  if (!iso) {
    return value?.trim() ?? "";
  }

  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function presentText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function getIssuerFiscalConfigurationStatus(
  input: IssuerFiscalConfigurationInput,
): { complete: boolean; missingFields: IssuerFiscalField[] } {
  const missingFields = ISSUER_FISCAL_FIELDS.filter((field) => {
    switch (field) {
      case "issuerName":
      case "issuerAddress":
      case "issuerCity":
      case "issuerProvince":
      case "issuerIvaCondition":
      case "issuerGrossIncome":
      case "pointOfSale":
        return !presentText(input[field]);
      case "issuerCuit":
        return !isValidCuit(input.issuerCuit ?? "");
      case "issuerActivitiesStartedAt":
        return parseActivitiesStartedAt(input.issuerActivitiesStartedAt) === null;
      default: {
        const unexpected: never = field;
        return unexpected;
      }
    }
  });

  return {
    complete: missingFields.length === 0,
    missingFields,
  };
}
