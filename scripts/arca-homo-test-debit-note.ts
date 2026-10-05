/**
 * Dry-run de UNA Nota de Débito A de homologación.
 * La base es la segunda Factura A de cuenta corriente, no la de contado.
 *
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-debit-note.ts --invoice-id=cmuv8gxqo0001c0f0h2ln2fku
 *
 * --execute sigue bloqueado. La UUID de esa nota será nueva.
 * Los imports de base entran después de validar la CLI para abortar
 * antes de abrir Prisma. No hay una dependencia circular.
 */
import { config as loadEnv } from "dotenv";
import { invoiceOutstandingCents } from "@/features/billing/utils/invoice-settlement";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";
import {
  assertCashInvoiceRejectsDebit,
  assertHomoDebitNoteArgs,
  describeHomoDebitNoteDryRun,
  HOMO_DEBIT_NOTE_CASH_INVOICE_ID,
  HOMO_DEBIT_NOTE_INVOICE_ID,
  HomoDebitNoteAbort,
  parseHomoDebitNoteArgs,
  selectDebitBaseInvoice,
  type HomoDebitNoteInvoice,
} from "./arca-homo-test-debit-note-plan";

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
  const args = parseHomoDebitNoteArgs(process.argv.slice(2));
  assertHomoDebitNoteArgs(args);

  const restoreNetwork = installNetworkGuard();
  const { prisma } = await import("@/server/database/prisma");

  try {
    const settings = await prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
    });

    if (!settings?.issuerCuit?.trim()) {
      throw new HomoDebitNoteAbort("La configuración fiscal no tiene CUIT de emisor.");
    }

    if (settings.environment !== "PRODUCCION") {
      throw new HomoDebitNoteAbort("BillingFiscalSettings no está en PRODUCCION.");
    }

    const rows = await prisma.billingInvoice.findMany({
      where: {
        environment: "HOMOLOGACION",
        fiscalStatus: "AUTORIZADA",
        invoiceType: "A",
        pointOfSale: "0007",
      },
      select: {
        id: true,
        invoiceNumber: true,
        environment: true,
        fiscalStatus: true,
        invoiceType: true,
        pointOfSale: true,
        paymentMethod: true,
        totalVisualRounded: true,
        cae: true,
      },
    });
    const selected = selectDebitBaseInvoice(
      rows.map((row) => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        environment: row.environment,
        fiscalStatus: row.fiscalStatus,
        invoiceType: row.invoiceType,
        pointOfSale: row.pointOfSale,
        paymentMethod: row.paymentMethod,
        totalCents: pesosToCents(row.totalVisualRounded.toNumber()),
        caePresent: Boolean(row.cae?.trim()),
      })),
    );

    if (selected.id !== args.invoiceId || selected.id !== HOMO_DEBIT_NOTE_INVOICE_ID) {
      throw new HomoDebitNoteAbort("La factura elegida no es la candidata única.");
    }

    const stored = await prisma.billingInvoice.findUnique({
      where: { id: selected.id },
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
        paymentMethod: true,
        paymentStatus: true,
        totalVisualRounded: true,
        clientId: true,
        clientCode: true,
        clientName: true,
        clientIdentificationType: true,
        clientIdentificationNumber: true,
        clientIvaCondition: true,
      },
    });
    const cash = await prisma.billingInvoice.findUnique({
      where: { id: HOMO_DEBIT_NOTE_CASH_INVOICE_ID },
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
        paymentMethod: true,
        paymentStatus: true,
        totalVisualRounded: true,
        clientId: true,
        clientCode: true,
        clientName: true,
        clientIdentificationType: true,
        clientIdentificationNumber: true,
        clientIvaCondition: true,
      },
    });

    if (!stored || !cash || cash.paymentMethod !== "CONTADO") {
      throw new HomoDebitNoteAbort("No están la factura base y la factura de contado anterior.");
    }

    const [credits, debits, allocated] = await Promise.all([
      prisma.billingNote.aggregate({
        where: { invoiceId: stored.id, kind: "CREDIT", fiscalStatus: "AUTORIZADA" },
        _sum: { amount: true },
      }),
      prisma.billingNote.aggregate({
        where: { invoiceId: stored.id, kind: "DEBIT", fiscalStatus: "AUTORIZADA" },
        _sum: { amount: true },
      }),
      prisma.billingReceiptAllocation.aggregate({
        where: { invoiceId: stored.id },
        _sum: { amount: true },
      }),
    ]);
    const invoice: HomoDebitNoteInvoice = {
      id: stored.id,
      invoiceNumber: stored.invoiceNumber,
      environment: stored.environment,
      fiscalStatus: stored.fiscalStatus,
      invoiceType: stored.invoiceType,
      pointOfSale: stored.pointOfSale,
      sequenceNumber: stored.sequenceNumber,
      issuedAt: stored.issuedAt,
      cae: stored.cae,
      ivaPercent: stored.ivaPercent.toNumber(),
      paymentMethod: stored.paymentMethod,
      paymentStatus: stored.paymentStatus,
      totalCents: pesosToCents(stored.totalVisualRounded.toNumber()),
      outstandingCents: invoiceOutstandingCents(
        pesosToCents(stored.totalVisualRounded.toNumber()),
        pesosToCents(credits._sum.amount?.toNumber() ?? 0),
        pesosToCents(debits._sum.amount?.toNumber() ?? 0),
        pesosToCents(allocated._sum.amount?.toNumber() ?? 0),
      ),
      client: {
        id: stored.clientId,
        code: stored.clientCode,
        name: stored.clientName,
        identificationType: stored.clientIdentificationType,
        identificationNumber: stored.clientIdentificationNumber,
        ivaCondition: stored.clientIvaCondition,
      },
    };
    const beforeUpdatedAt = settings.updatedAt.getTime();

    assertCashInvoiceRejectsDebit({
      ...invoice,
      id: cash.id,
      invoiceNumber: cash.invoiceNumber,
      environment: cash.environment,
      fiscalStatus: cash.fiscalStatus,
      invoiceType: cash.invoiceType,
      pointOfSale: cash.pointOfSale,
      sequenceNumber: cash.sequenceNumber,
      issuedAt: cash.issuedAt,
      cae: cash.cae,
      ivaPercent: cash.ivaPercent.toNumber(),
      paymentMethod: cash.paymentMethod,
      paymentStatus: cash.paymentStatus,
      totalCents: pesosToCents(cash.totalVisualRounded.toNumber()),
      client: {
        id: cash.clientId,
        code: cash.clientCode,
        name: cash.clientName,
        identificationType: cash.clientIdentificationType,
        identificationNumber: cash.clientIdentificationNumber,
        ivaCondition: cash.clientIvaCondition,
      },
    });

    const summary = describeHomoDebitNoteDryRun({
      invoice,
      issuerCuit: settings.issuerCuit,
      settingsEnvironment: settings.environment,
      settingsUpdatedAt: settings.updatedAt.toISOString(),
      cashRejected: true,
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
      throw new HomoDebitNoteAbort("BillingFiscalSettings cambió durante el dry-run.");
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
    if (error instanceof HomoDebitNoteAbort) {
      console.error(`ABORTO: ${error.message}`);
      process.exit(error.exitCode);
    }

    const message = error instanceof Error ? error.message : "error";
    console.error(`ABORTO: ${message.replace(/\b\d{10,}\b/g, "[redactado]")}`);
    process.exit(1);
  });
