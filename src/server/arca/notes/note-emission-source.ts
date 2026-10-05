import "server-only";
import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceFiscalStatus,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingPaymentMethod,
  BillingPaymentStatus,
} from "@/generated/prisma/client";
import type { IssuerFiscalConfigurationInput } from "@/features/billing/utils/issuer-fiscal-configuration";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import {
  BILLING_FISCAL_SETTINGS_ID,
  billingFiscalSettingsRepository,
} from "@/server/repositories/billing-fiscal-settings.repository";
import { prisma } from "@/server/database/prisma";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";

export type ArcaNoteEmissionSource = {
  settingsEnvironment: BillingFiscalEnvironment;
  issuerCuit: string;
  issuer: IssuerFiscalConfigurationInput;
  invoice: {
    id: string;
    environment: BillingFiscalEnvironment;
    fiscalStatus: BillingInvoiceFiscalStatus;
    invoiceType: BillingInvoiceType;
    pointOfSale: string;
    sequenceNumber: number;
    issuedAt: Date;
    cae: string | null;
    ivaPercent: number;
    totalVisualRoundedCents: number;
    paymentMethod: BillingPaymentMethod;
    paymentStatus: BillingPaymentStatus;
    client: {
      id: string | null;
      code: string;
      name: string;
      identificationType: BillingIdentificationType;
      identificationNumber: string | null;
      ivaCondition: BillingIvaCondition;
    };
  };
  authorizedCreditCents: number;
  authorizedDebitCents: number;
  allocatedCents: number;
};

async function authorizedCents(
  invoiceId: string,
  kind: "CREDIT" | "DEBIT",
): Promise<number> {
  const result = await prisma.billingNote.aggregate({
    where: { invoiceId, kind, fiscalStatus: "AUTORIZADA" },
    _sum: { amount: true },
  });

  return pesosToCents(result._sum.amount?.toNumber() ?? 0);
}

type NoteSourceInvoice = {
  id: string;
  environment: BillingFiscalEnvironment;
  fiscalStatus: BillingInvoiceFiscalStatus;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  sequenceNumber: number;
  issuedAt: Date;
  cae: string | null;
  ivaPercent: { toNumber(): number };
  totalVisualRounded: { toNumber(): number };
  paymentMethod: BillingPaymentMethod;
  paymentStatus: BillingPaymentStatus;
  clientId: string | null;
  clientCode: string;
  clientName: string;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
};

type NoteSourceSettings = {
  environment: BillingFiscalEnvironment;
  issuerCuit: string | null;
  issuerName: string | null;
  issuerAddress: string | null;
  issuerCity: string | null;
  issuerProvince: string | null;
  issuerIvaCondition: string | null;
  issuerGrossIncome: string | null;
  issuerActivitiesStartedAt: string | null;
  pointOfSale: string;
};

const invoiceSelect = {
  id: true,
  environment: true,
  fiscalStatus: true,
  invoiceType: true,
  pointOfSale: true,
  sequenceNumber: true,
  issuedAt: true,
  cae: true,
  ivaPercent: true,
  totalVisualRounded: true,
  paymentMethod: true,
  paymentStatus: true,
  clientId: true,
  clientCode: true,
  clientName: true,
  clientIdentificationType: true,
  clientIdentificationNumber: true,
  clientIvaCondition: true,
} as const;

export function assembleArcaNoteEmissionSource(input: {
  settingsEnvironment: BillingFiscalEnvironment;
  settings: NoteSourceSettings;
  invoice: NoteSourceInvoice;
  authorizedCreditCents: number;
  authorizedDebitCents: number;
  allocatedCents: number;
}): ArcaNoteEmissionSource {
  return {
    settingsEnvironment: input.settingsEnvironment,
    issuerCuit: input.settings.issuerCuit ?? "",
    issuer: {
      issuerName: input.settings.issuerName,
      issuerCuit: input.settings.issuerCuit,
      issuerAddress: input.settings.issuerAddress,
      issuerCity: input.settings.issuerCity,
      issuerProvince: input.settings.issuerProvince,
      issuerIvaCondition: input.settings.issuerIvaCondition,
      issuerGrossIncome: input.settings.issuerGrossIncome,
      issuerActivitiesStartedAt: input.settings.issuerActivitiesStartedAt,
      pointOfSale: input.settings.pointOfSale,
    },
    invoice: {
      id: input.invoice.id,
      environment: input.invoice.environment,
      fiscalStatus: input.invoice.fiscalStatus,
      invoiceType: input.invoice.invoiceType,
      pointOfSale: input.invoice.pointOfSale,
      sequenceNumber: input.invoice.sequenceNumber,
      issuedAt: input.invoice.issuedAt,
      cae: input.invoice.cae,
      ivaPercent: input.invoice.ivaPercent.toNumber(),
      totalVisualRoundedCents: pesosToCents(input.invoice.totalVisualRounded.toNumber()),
      paymentMethod: input.invoice.paymentMethod,
      paymentStatus: input.invoice.paymentStatus,
      client: {
        id: input.invoice.clientId,
        code: input.invoice.clientCode,
        name: input.invoice.clientName,
        identificationType: input.invoice.clientIdentificationType,
        identificationNumber: input.invoice.clientIdentificationNumber,
        ivaCondition: input.invoice.clientIvaCondition,
      },
    },
    authorizedCreditCents: input.authorizedCreditCents,
    authorizedDebitCents: input.authorizedDebitCents,
    allocatedCents: input.allocatedCents,
  };
}

export function toHomologationHarnessSource(
  source: ArcaNoteEmissionSource,
): ArcaNoteEmissionSource {
  if (source.invoice.environment !== "HOMOLOGACION") {
    throw new BillingInvoiceError(
      "La factura no es de HOMOLOGACION.",
      "VALIDATION_ERROR",
    );
  }

  if (source.invoice.fiscalStatus !== "AUTORIZADA" || !source.invoice.cae?.trim()) {
    throw new BillingInvoiceError(
      "La factura asociada no está autorizada por ARCA.",
      "VALIDATION_ERROR",
    );
  }

  return {
    ...source,
    settingsEnvironment: "HOMOLOGACION",
  };
}

async function readCommercialFigures(invoiceId: string): Promise<{
  authorizedCreditCents: number;
  authorizedDebitCents: number;
  allocatedCents: number;
}> {
  const [credits, debits, allocated] = await Promise.all([
    authorizedCents(invoiceId, "CREDIT"),
    authorizedCents(invoiceId, "DEBIT"),
    prisma.billingReceiptAllocation.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    }),
  ]);

  return {
    authorizedCreditCents: credits,
    authorizedDebitCents: debits,
    allocatedCents: pesosToCents(allocated._sum.amount?.toNumber() ?? 0),
  };
}

export async function loadArcaNoteEmissionSource(
  invoiceId: string,
): Promise<ArcaNoteEmissionSource | null> {
  const [settings, invoice, figures] = await Promise.all([
    billingFiscalSettingsRepository.getOrCreate(),
    prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      select: invoiceSelect,
    }),
    readCommercialFigures(invoiceId),
  ]);

  if (!invoice) {
    return null;
  }

  return assembleArcaNoteEmissionSource({
    settingsEnvironment: settings.environment,
    settings,
    invoice,
    ...figures,
  });
}

export async function loadHomologationNoteEmissionSource(
  invoiceId: string,
): Promise<ArcaNoteEmissionSource | null> {
  const [settings, invoice, figures] = await Promise.all([
    prisma.billingFiscalSettings.findUnique({
      where: { id: BILLING_FISCAL_SETTINGS_ID },
    }),
    prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      select: invoiceSelect,
    }),
    readCommercialFigures(invoiceId),
  ]);

  if (!settings) {
    throw new BillingInvoiceError(
      "La configuración fiscal no está disponible.",
      "VALIDATION_ERROR",
    );
  }

  if (!invoice) {
    return null;
  }

  return toHomologationHarnessSource(
    assembleArcaNoteEmissionSource({
      settingsEnvironment: settings.environment,
      settings,
      invoice,
      ...figures,
    }),
  );
}
