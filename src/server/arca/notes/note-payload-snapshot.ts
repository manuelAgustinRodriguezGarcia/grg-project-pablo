import "server-only";
import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingNoteKind,
} from "@/generated/prisma/client";
import {
  getIssuerFiscalConfigurationStatus,
  parseActivitiesStartedAt,
  type IssuerFiscalConfigurationInput,
} from "@/features/billing/utils/issuer-fiscal-configuration";
import { canonicalScaled } from "@/server/arca/invoices/billing-payload-snapshot";
import { normalizeIdentificationDigits } from "@/shared/utils/identification";

export type ArcaNotePayloadInput = {
  kind: BillingNoteKind;
  invoiceId: string;
  reason: string;
  amountCents: number;
  netAmountCents: number;
  ivaAmountCents: number;
  ivaPercent: number | string;
  createdByUserId: string;
  issuedAt: string;
  client: {
    id?: string | null;
    code: string;
    name: string;
    identificationType: BillingIdentificationType;
    identificationNumber?: string | null;
    ivaCondition: BillingIvaCondition;
  };
  associatedInvoice: {
    environment: BillingFiscalEnvironment;
    invoiceType: BillingInvoiceType;
    pointOfSale: string;
    sequenceNumber: number;
    issuedAt: string;
    cae: string;
    totalVisualRoundedCents: number;
  };
  issuer: IssuerFiscalConfigurationInput;
};

export type ArcaNoteIssuerSnapshot = {
  name: string;
  cuit: string;
  address: string;
  city: string;
  province: string;
  ivaCondition: string;
  grossIncome: string;
  activitiesStartedAt: string;
};

export type ArcaNotePersistenceSnapshot = {
  documentKind: "NOTE";
  kind: BillingNoteKind;
  invoiceId: string;
  reason: string;
  amountCents: number;
  netAmountCents: number;
  ivaAmountCents: number;
  ivaPercent: string;
  createdByUserId: string;
  issuedAt: string;
  client: {
    id: string | null;
    code: string;
    name: string;
    identificationType: BillingIdentificationType;
    identificationNumber: string | null;
    ivaCondition: BillingIvaCondition;
  };
  associatedInvoice: {
    environment: Exclude<BillingFiscalEnvironment, "MODO_PRUEBA">;
    invoiceType: BillingInvoiceType;
    pointOfSale: string;
    sequenceNumber: number;
    issuedAt: string;
    fiscalStatus: "AUTORIZADA";
    cae: string;
    totalVisualRoundedCents: number;
  };
  issuerSnapshot: ArcaNoteIssuerSnapshot;
};

function invalid(message: string): Error {
  return new Error(message);
}

function requiredText(value: string, message: string): string {
  const text = value.trim();

  if (!text) {
    throw invalid(message);
  }

  return text;
}

function noteReason(value: string): string {
  const text = requiredText(value, "Indicá el motivo.");

  if (text.length > 1000) {
    throw invalid("El motivo no puede superar 1000 caracteres.");
  }

  return text;
}

function cents(value: number, message: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw invalid(message);
  }

  return value;
}

function noteKind(value: string): BillingNoteKind {
  switch (value) {
    case "CREDIT":
    case "DEBIT":
      return value;
    default:
      throw invalid("El tipo de nota del snapshot no es válido.");
  }
}

function invoiceType(value: string): BillingInvoiceType {
  switch (value) {
    case "A":
    case "B":
      return value;
    default:
      throw invalid("La letra de la factura asociada no es válida.");
  }
}

function identificationType(value: string): BillingIdentificationType {
  switch (value) {
    case "CUIT":
    case "DNI":
    case "NINGUNO":
      return value;
    default:
      throw invalid("El tipo de identificación del snapshot no es válido.");
  }
}

function ivaCondition(value: string): BillingIvaCondition {
  switch (value) {
    case "RESPONSABLE_INSCRIPTO":
    case "RESPONSABLE_NO_INSCRIPTO":
    case "MONOTRIBUTISTA":
    case "CONSUMIDOR_FINAL":
    case "EXENTO":
      return value;
    default:
      throw invalid("La condición de IVA del snapshot no es válida.");
  }
}

function fiscalEnvironment(
  value: string,
): Exclude<BillingFiscalEnvironment, "MODO_PRUEBA"> {
  switch (value) {
    case "HOMOLOGACION":
    case "PRODUCCION":
      return value;
    default:
      throw invalid("El ambiente de la factura asociada no es fiscal.");
  }
}

const ISSUER_INCOMPLETE = "Falta completar la configuración fiscal del emisor.";

function issuerSnapshot(input: IssuerFiscalConfigurationInput): ArcaNoteIssuerSnapshot {
  if (!getIssuerFiscalConfigurationStatus(input).complete) {
    throw invalid(ISSUER_INCOMPLETE);
  }

  const name = input.issuerName?.trim() ?? "";
  const cuit = normalizeIdentificationDigits(input.issuerCuit ?? "");
  const address = input.issuerAddress?.trim() ?? "";
  const city = input.issuerCity?.trim() ?? "";
  const province = input.issuerProvince?.trim() ?? "";
  const ivaCondition = input.issuerIvaCondition?.trim() ?? "";
  const grossIncome = input.issuerGrossIncome?.trim() ?? "";
  const activitiesStartedAt = parseActivitiesStartedAt(input.issuerActivitiesStartedAt);

  if (
    !name ||
    !cuit ||
    !address ||
    !city ||
    !province ||
    !ivaCondition ||
    !grossIncome ||
    !activitiesStartedAt
  ) {
    throw invalid(ISSUER_INCOMPLETE);
  }

  return {
    name,
    cuit,
    address,
    city,
    province,
    ivaCondition,
    grossIncome,
    activitiesStartedAt,
  };
}

function issuerInputFromStored(
  value: unknown,
  pointOfSale: string,
): IssuerFiscalConfigurationInput {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const text = (key: string) => (typeof record[key] === "string" ? record[key] : null);

  return {
    issuerName: text("name"),
    issuerCuit: text("cuit"),
    issuerAddress: text("address"),
    issuerCity: text("city"),
    issuerProvince: text("province"),
    issuerIvaCondition: text("ivaCondition"),
    issuerGrossIncome: text("grossIncome"),
    issuerActivitiesStartedAt: text("activitiesStartedAt"),
    pointOfSale,
  };
}

function identificationNumber(
  type: BillingIdentificationType,
  value: string | null | undefined,
): string | null {
  if (type === "NINGUNO") {
    return null;
  }

  const digits = normalizeIdentificationDigits(value ?? "");
  return digits.length > 0 ? digits : null;
}

export function isNoteSnapshotJson(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return (value as { documentKind?: unknown }).documentKind === "NOTE";
}

export function isArcaNoteBillingSnapshot(
  value: unknown,
): value is ArcaNotePersistenceSnapshot {
  return isNoteSnapshotJson(value);
}

export function canonicalizeArcaNotePayload(
  input: ArcaNotePayloadInput,
): ArcaNotePersistenceSnapshot {
  const kind = noteKind(input.kind);
  const amountCents = cents(input.amountCents, "El importe de la nota no es válido.");
  const netAmountCents = cents(input.netAmountCents, "El neto de la nota no es válido.");
  const ivaAmountCents = cents(input.ivaAmountCents, "El IVA de la nota no es válido.");

  if (amountCents <= 0) {
    throw invalid("El importe de la nota no es válido.");
  }

  if (netAmountCents + ivaAmountCents !== amountCents) {
    throw invalid("Los importes de la nota no cierran.");
  }

  const associatedType = invoiceType(input.associatedInvoice.invoiceType);
  const environment = fiscalEnvironment(input.associatedInvoice.environment);
  const sequenceNumber = input.associatedInvoice.sequenceNumber;

  if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber <= 0) {
    throw invalid("La factura asociada no tiene número fiscal.");
  }

  const clientType = identificationType(input.client.identificationType);
  const issuedAt = new Date(input.issuedAt);
  const associatedIssuedAt = new Date(input.associatedInvoice.issuedAt);

  if (Number.isNaN(issuedAt.getTime()) || Number.isNaN(associatedIssuedAt.getTime())) {
    throw invalid("La fecha de la nota no es válida.");
  }

  return {
    documentKind: "NOTE",
    kind,
    invoiceId: requiredText(input.invoiceId, "Falta la factura asociada."),
    reason: noteReason(input.reason),
    amountCents,
    netAmountCents,
    ivaAmountCents,
    ivaPercent: canonicalScaled(input.ivaPercent, 2, "La alícuota de IVA no es válida."),
    createdByUserId: requiredText(input.createdByUserId, "Falta el usuario de la nota."),
    issuedAt: issuedAt.toISOString(),
    client: {
      id: input.client.id?.trim() || null,
      code: requiredText(input.client.code, "Falta el código del cliente."),
      name: requiredText(input.client.name, "Falta el nombre del cliente."),
      identificationType: clientType,
      identificationNumber: identificationNumber(
        clientType,
        input.client.identificationNumber,
      ),
      ivaCondition: ivaCondition(input.client.ivaCondition),
    },
    associatedInvoice: {
      environment,
      invoiceType: associatedType,
      pointOfSale: requiredText(
        input.associatedInvoice.pointOfSale,
        "La factura asociada no tiene punto de venta fiscal.",
      ),
      sequenceNumber,
      issuedAt: associatedIssuedAt.toISOString(),
      fiscalStatus: "AUTORIZADA",
      cae: requiredText(input.associatedInvoice.cae, "La factura asociada no tiene CAE."),
      totalVisualRoundedCents: cents(
        input.associatedInvoice.totalVisualRoundedCents,
        "El total de la factura asociada no es válido.",
      ),
    },
    issuerSnapshot: issuerSnapshot(input.issuer),
  };
}

export function parseArcaNoteBillingSnapshot(
  value: unknown,
): ArcaNotePersistenceSnapshot | null {
  if (!isNoteSnapshotJson(value)) {
    return null;
  }

  try {
    const record = value as ArcaNotePayloadInput & {
      issuerSnapshot?: unknown;
    };
    const pointOfSale =
      typeof record.associatedInvoice?.pointOfSale === "string"
        ? record.associatedInvoice.pointOfSale
        : "";

    return canonicalizeArcaNotePayload({
      ...record,
      issuer:
        record.issuer ?? issuerInputFromStored(record.issuerSnapshot, pointOfSale),
      associatedInvoice: {
        ...record.associatedInvoice,
        environment: record.associatedInvoice.environment,
      },
    });
  } catch {
    return null;
  }
}
