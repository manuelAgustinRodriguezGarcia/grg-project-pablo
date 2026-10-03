import type {
  BillingFiscalEnvironment,
  BillingInvoiceFiscalStatus,
} from "@/generated/prisma/client";

export function invoiceFiscalPdfReady(invoice: {
  environment: BillingFiscalEnvironment;
  fiscalStatus: BillingInvoiceFiscalStatus;
  caePresent?: boolean;
  caeExpiresAt?: string | null;
}): boolean {
  switch (invoice.environment) {
    case "MODO_PRUEBA":
      return false;
    case "HOMOLOGACION":
    case "PRODUCCION":
      return (
        invoice.fiscalStatus === "AUTORIZADA" &&
        invoice.caePresent === true &&
        Boolean(invoice.caeExpiresAt)
      );
    default: {
      const unexpected: never = invoice.environment;
      return unexpected;
    }
  }
}
