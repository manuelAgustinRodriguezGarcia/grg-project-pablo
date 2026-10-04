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
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
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

export async function loadArcaNoteEmissionSource(
  invoiceId: string,
): Promise<ArcaNoteEmissionSource | null> {
  const [settings, invoice, credits, debits, allocated] = await Promise.all([
    billingFiscalSettingsRepository.getOrCreate(),
    prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      select: {
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
      },
    }),
    authorizedCents(invoiceId, "CREDIT"),
    authorizedCents(invoiceId, "DEBIT"),
    prisma.billingReceiptAllocation.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    }),
  ]);

  if (!invoice) {
    return null;
  }

  return {
    settingsEnvironment: settings.environment,
    issuerCuit: settings.issuerCuit ?? "",
    issuer: {
      issuerName: settings.issuerName,
      issuerCuit: settings.issuerCuit,
      issuerAddress: settings.issuerAddress,
      issuerCity: settings.issuerCity,
      issuerProvince: settings.issuerProvince,
      issuerIvaCondition: settings.issuerIvaCondition,
      issuerGrossIncome: settings.issuerGrossIncome,
      issuerActivitiesStartedAt: settings.issuerActivitiesStartedAt,
      pointOfSale: settings.pointOfSale,
    },
    invoice: {
      id: invoice.id,
      environment: invoice.environment,
      fiscalStatus: invoice.fiscalStatus,
      invoiceType: invoice.invoiceType,
      pointOfSale: invoice.pointOfSale,
      sequenceNumber: invoice.sequenceNumber,
      issuedAt: invoice.issuedAt,
      cae: invoice.cae,
      ivaPercent: invoice.ivaPercent.toNumber(),
      totalVisualRoundedCents: pesosToCents(invoice.totalVisualRounded.toNumber()),
      paymentMethod: invoice.paymentMethod,
      paymentStatus: invoice.paymentStatus,
      client: {
        id: invoice.clientId,
        code: invoice.clientCode,
        name: invoice.clientName,
        identificationType: invoice.clientIdentificationType,
        identificationNumber: invoice.clientIdentificationNumber,
        ivaCondition: invoice.clientIvaCondition,
      },
    },
    authorizedCreditCents: credits,
    authorizedDebitCents: debits,
    allocatedCents: pesosToCents(allocated._sum.amount?.toNumber() ?? 0),
  };
}
