/**
 * Dry-run de la Factura A de homologación en cuenta corriente,
 * base de una futura Nota de Débito A.
 *
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-debit-base-invoice.ts --client-id=cmurf5jgy00038cf0f4r2m3ov
 *
 * --execute sigue bloqueado. La UUID de esa factura será nueva y distinta
 * de la primera Factura A, de la NC A y de la futura ND.
 * Los imports de base entran después de validar la CLI para abortar
 * antes de abrir Prisma. No hay una dependencia circular.
 */
import { config as loadEnv } from "dotenv";
import {
  assertCashInvoiceRejectsDebit,
  assertDebitBaseArgs,
  buildDebitBaseIntention,
  DEBIT_BASE_CLIENT_ID,
  DebitBaseAbort,
  describeDebitBaseDryRun,
  parseDebitBaseArgs,
} from "./arca-homo-test-debit-base-invoice-plan";

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
  const args = parseDebitBaseArgs(process.argv.slice(2));
  assertDebitBaseArgs(args);

  const restoreNetwork = installNetworkGuard();
  const { prisma } = await import("@/server/database/prisma");

  try {
    const settings = await prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
    });

    if (!settings?.issuerCuit?.trim()) {
      throw new DebitBaseAbort("La configuración fiscal no tiene CUIT de emisor.");
    }

    if (settings.environment !== "PRODUCCION") {
      throw new DebitBaseAbort("BillingFiscalSettings no está en PRODUCCION.");
    }

    const client = await prisma.billingClient.findUnique({
      where: { id: DEBIT_BASE_CLIENT_ID },
    });

    if (!client) {
      throw new DebitBaseAbort("Cliente no encontrado.");
    }

    const previousInvoices = await prisma.billingInvoice.findMany({
      where: {
        environment: "HOMOLOGACION",
        invoiceType: "A",
        pointOfSale: "0007",
        sequenceNumber: 1,
        invoiceNumber: "0007-00000001",
      },
      select: { paymentMethod: true, paymentStatus: true },
    });

    if (previousInvoices.length !== 1) {
      throw new DebitBaseAbort("La factura de contado anterior no está identificada de forma única.");
    }

    const previous = previousInvoices[0];

    if (!previous || previous.paymentMethod !== "CONTADO") {
      throw new DebitBaseAbort("La factura anterior ya no es de contado.");
    }

    assertCashInvoiceRejectsDebit(client, previous.paymentStatus);
    const beforeUpdatedAt = settings.updatedAt.getTime();
    const intention = buildDebitBaseIntention({
      client,
      settings,
      issuedAt: new Date(),
    });
    const summary = describeDebitBaseDryRun({
      intention,
      issuerCuit: settings.issuerCuit,
      pointOfSaleText: settings.pointOfSale,
      settingsEnvironment: settings.environment,
      settingsUpdatedAt: settings.updatedAt.toISOString(),
      previousCashRejected: true,
    });
    const after = await prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
      select: { environment: true, updatedAt: true },
    });

    if (
      !after ||
      after.environment !== "PRODUCCION" ||
      after.updatedAt.getTime() !== beforeUpdatedAt
    ) {
      throw new DebitBaseAbort("BillingFiscalSettings cambió durante el dry-run.");
    }

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
    if (error instanceof DebitBaseAbort) {
      console.error(`ABORTO: ${error.message}`);
      process.exit(error.exitCode);
    }

    const message = error instanceof Error ? error.message : "error";
    console.error(`ABORTO: ${message.replace(/\b\d{10,}\b/g, "[redactado]")}`);
    process.exit(1);
  });
