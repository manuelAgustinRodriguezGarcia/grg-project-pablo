import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";

export async function readActiveFiscalEnvironment(): Promise<BillingFiscalEnvironment> {
  const environment = await billingFiscalSettingsRepository.readEnvironment();

  if (!environment) {
    throw new BillingInvoiceError(
      "La configuración fiscal no está disponible.",
      "VALIDATION_ERROR",
    );
  }

  return environment;
}

export function scopeFiscalDocuments<
  T extends { environment: BillingFiscalEnvironment },
>(documents: readonly T[], activeEnvironment: BillingFiscalEnvironment): T[] {
  return documents.filter(
    (document) => document.environment === activeEnvironment,
  );
}

export function scopeInvoicesForFiscalEnvironment<
  T extends {
    environment: BillingFiscalEnvironment;
    billingNotes: Array<{ environment: BillingFiscalEnvironment }>;
  },
>(invoices: readonly T[], activeEnvironment: BillingFiscalEnvironment): T[] {
  return scopeFiscalDocuments(invoices, activeEnvironment).map((invoice) => ({
    ...invoice,
    billingNotes: scopeFiscalDocuments(invoice.billingNotes, activeEnvironment),
  }));
}

export function scopeReceiptsToFiscalEnvironment<
  T extends {
    allocations: ReadonlyArray<{
      invoice: { environment: BillingFiscalEnvironment };
    }>;
  },
>(receipts: readonly T[], activeEnvironment: BillingFiscalEnvironment): T[] {
  return receipts.filter((receipt) =>
    receipt.allocations.every(
      (allocation) => allocation.invoice.environment === activeEnvironment,
    ),
  );
}
