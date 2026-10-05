/**
 * Harness de UNA Nota de Crédito A de homologación.
 *
 * Dry-run por defecto. --execute queda bloqueado antes de WSAA, WSFE,
 * BillingArcaEmission y BillingNote.
 *
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-credit-note.ts --invoice-id=<BillingInvoice.id>
 */
import { config as loadEnv } from "dotenv";
import {
  assertHomoCreditNoteArgs,
  describeHomoCreditNoteDryRun,
  HomoCreditNoteAbort,
  parseHomoCreditNoteArgs,
  redactCreditNoteText,
} from "./arca-homo-test-credit-note-plan";

loadEnv({ path: ".env", quiet: true });
loadEnv({ path: ".env.local", override: true, quiet: true });

const FISCAL_SETTINGS_ID = "fiscal-settings";

function installNetworkGuard(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    throw new Error(`Red bloqueada en dry-run: ${url}`);
  };

  return () => {
    globalThis.fetch = original;
  };
}

async function main(): Promise<number> {
  const args = parseHomoCreditNoteArgs(process.argv.slice(2));
  assertHomoCreditNoteArgs(args);

  const restoreNetwork = installNetworkGuard();
  const { prisma } = await import("@/server/database/prisma");

  try {
    const settings = await prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
      select: {
        environment: true,
        updatedAt: true,
        issuerCuit: true,
      },
    });

    if (!settings?.issuerCuit?.trim()) {
      throw new HomoCreditNoteAbort("La configuración fiscal no tiene CUIT de emisor.");
    }

    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: args.invoiceId ?? "" },
      select: {
        id: true,
        invoiceNumber: true,
        environment: true,
        fiscalStatus: true,
        invoiceType: true,
        pointOfSale: true,
        sequenceNumber: true,
        issuedAt: true,
        cae: true,
        ivaPercent: true,
        clientIdentificationType: true,
        clientIdentificationNumber: true,
        clientIvaCondition: true,
      },
    });

    const summary = describeHomoCreditNoteDryRun({
      invoice: invoice
        ? {
            ...invoice,
            ivaPercent: invoice.ivaPercent.toNumber(),
          }
        : null,
      issuerCuit: settings.issuerCuit,
      settingsEnvironment: settings.environment,
      settingsUpdatedAt: settings.updatedAt.toISOString(),
    });

    console.log(JSON.stringify(summary, null, 2));
    return 0;
  } finally {
    restoreNetwork();
    await prisma.$disconnect();
  }
}

void main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error: unknown) => {
    if (error instanceof HomoCreditNoteAbort) {
      console.error(`ABORTO: ${error.message}`);
      process.exit(error.exitCode);
    }

    const message = error instanceof Error ? error.message : "error";
    console.error(`ABORTO: ${redactCreditNoteText(message)}`);
    process.exit(1);
  });
