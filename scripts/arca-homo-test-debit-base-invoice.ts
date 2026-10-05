/**
 * Factura A de homologación en cuenta corriente, base de una futura Nota de Débito.
 * Dry-run y --execute arman la misma intención. El número lo asigna issueArcaInvoice.
 * Esta fase no cablea la emisión de la nota.
 *
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-debit-base-invoice.ts --client-id=cmurf5jgy00038cf0f4r2m3ov
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-debit-base-invoice.ts --execute --confirm-homologacion --client-id=cmurf5jgy00038cf0f4r2m3ov --idempotency-key=<UUID>
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-debit-base-invoice.ts --verify --idempotency-key=<UUID>
 *
 * Los imports de base entran después de validar la CLI para abortar
 * antes de abrir Prisma. No hay una dependencia circular.
 */
import { config as loadEnv } from "dotenv";
import { invoiceOutstandingCents } from "@/features/billing/utils/invoice-settlement";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";
import {
  assertCashInvoiceRejectsDebit,
  assertDebitBaseArgs,
  assertDebitBaseCredentialNamesPresent,
  assertDebitBaseProductionIsolation,
  buildDebitBaseIntention,
  DEBIT_BASE_CLIENT_ID,
  DebitBaseAbort,
  describeDebitBaseDryRun,
  executeDebitBaseInvoice,
  formatDebitBaseVerify,
  parseDebitBaseArgs,
  redactDebitBaseText,
  SAME_KEY_RETRY_MESSAGE,
  type DebitBaseVerifyView,
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

async function verifyEmission(idempotencyKey: string): Promise<string> {
  const { prisma } = await import("@/server/database/prisma");
  const { arcaEmissionRepository } = await import(
    "@/server/arca/repositories/arca-emission.repository"
  );
  const { billingInvoiceRepository } = await import(
    "@/server/repositories/billing-invoice.repository"
  );
  const { billingNoteRepository } = await import(
    "@/server/repositories/billing-note.repository"
  );
  const { billingReceiptRepository } = await import(
    "@/server/repositories/billing-receipt.repository"
  );
  const {
    readActiveFiscalEnvironment,
    scopeFiscalDocuments,
    scopeInvoicesForFiscalEnvironment,
    scopeReceiptsToFiscalEnvironment,
  } = await import("@/server/services/billing-fiscal-scope");
  const { toBillingInvoiceListItem } = await import(
    "@/features/billing/types/billing-invoice.types"
  );
  const { toBillingNoteListItem } = await import(
    "@/features/billing/types/billing-note.types"
  );
  const { toBillingReceiptListItem } = await import(
    "@/features/billing/types/billing-receipt.types"
  );
  const { buildBillingDashboardMetrics } = await import(
    "@/features/billing/utils/billing-metrics"
  );
  const { buildDebtorClients } = await import(
    "@/features/billing/utils/invoice-list"
  );
  const { buildBillingMovements } = await import(
    "@/features/billing/utils/movement-list"
  );
  const { buildLibroIvaRows, libroIvaMonthRange } = await import(
    "@/features/billing/utils/libro-iva"
  );
  const { getValidArcaAccessTicket } = await import(
    "@/server/arca/tickets/access-ticket"
  );
  const { consultVoucher, getLastAuthorizedVoucher } = await import(
    "@/server/arca/wsfe/wsfe-client"
  );

  try {
    const settings = await prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
    });

    if (!settings || settings.environment !== "PRODUCCION") {
      throw new DebitBaseAbort("BillingFiscalSettings no está en PRODUCCION.");
    }

    const beforeUpdatedAt = settings.updatedAt.getTime();
    const activeEnvironment = await readActiveFiscalEnvironment();

    if (activeEnvironment !== "PRODUCCION") {
      throw new DebitBaseAbort("BillingFiscalSettings no está en PRODUCCION.");
    }

    const emission = await arcaEmissionRepository.findByIdempotencyKey(idempotencyKey);

    if (!emission?.invoiceId || emission.voucherNumber === null) {
      throw new DebitBaseAbort("No hay una emisión completada con esa idempotency key.");
    }

    if (
      emission.status !== "COMPLETED" ||
      emission.environment !== "HOMOLOGACION" ||
      emission.voucherType !== 1 ||
      emission.pointOfSale !== 7
    ) {
      throw new DebitBaseAbort("La emisión no es una Factura A de HOMOLOGACION.");
    }

    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: emission.invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        environment: true,
        fiscalStatus: true,
        invoiceType: true,
        pointOfSale: true,
        sequenceNumber: true,
        issuedAt: true,
        paymentMethod: true,
        paymentStatus: true,
        cae: true,
        clientId: true,
        totalVisualRounded: true,
      },
    });

    if (!invoice || invoice.clientId !== DEBIT_BASE_CLIENT_ID) {
      throw new DebitBaseAbort("La factura de la emisión no es la base esperada.");
    }

    const [credits, debits, allocated] = await Promise.all([
      prisma.billingNote.aggregate({
        where: { invoiceId: invoice.id, kind: "CREDIT", fiscalStatus: "AUTORIZADA" },
        _sum: { amount: true },
      }),
      prisma.billingNote.aggregate({
        where: { invoiceId: invoice.id, kind: "DEBIT", fiscalStatus: "AUTORIZADA" },
        _sum: { amount: true },
      }),
      prisma.billingReceiptAllocation.aggregate({
        where: { invoiceId: invoice.id },
        _sum: { amount: true },
      }),
    ]);
    const outstandingCents = invoiceOutstandingCents(
      pesosToCents(invoice.totalVisualRounded.toNumber()),
      pesosToCents(credits._sum.amount?.toNumber() ?? 0),
      pesosToCents(debits._sum.amount?.toNumber() ?? 0),
      pesosToCents(allocated._sum.amount?.toNumber() ?? 0),
    );
    const productionInvoices = scopeInvoicesForFiscalEnvironment(
      await billingInvoiceRepository.findAllOrdered(activeEnvironment),
      activeEnvironment,
    );
    const productionItems = productionInvoices.map(toBillingInvoiceListItem);
    const metrics = buildBillingDashboardMetrics(productionItems);
    buildDebtorClients(productionItems);
    const productionNotes = scopeFiscalDocuments(
      await billingNoteRepository.findAllOrdered(activeEnvironment),
      activeEnvironment,
    );
    const productionReceipts = scopeReceiptsToFiscalEnvironment(
      await billingReceiptRepository.findAllOrdered(activeEnvironment),
      activeEnvironment,
    );
    const movements = buildBillingMovements(
      productionReceipts.map(toBillingReceiptListItem),
      productionNotes.map(toBillingNoteListItem),
    );
    const range = libroIvaMonthRange(
      invoice.issuedAt.getFullYear(),
      invoice.issuedAt.getMonth() + 1,
    );
    const [libroInvoices, libroNotes] = await Promise.all([
      billingInvoiceRepository.findIssuedBetween(range.from, range.to, "PRODUCCION"),
      billingNoteRepository.findIssuedBetween(range.from, range.to, "PRODUCCION"),
    ]);
    const libroRows = buildLibroIvaRows(
      libroInvoices.map((row) => ({
        issuedAt: row.issuedAt,
        invoiceType: row.invoiceType,
        pointOfSale: row.pointOfSale,
        invoiceNumber: row.invoiceNumber,
        clientName: row.clientName,
        clientIdentificationType: row.clientIdentificationType,
        clientIdentificationNumber: row.clientIdentificationNumber,
        clientIvaCondition: row.clientIvaCondition,
        subtotal: row.subtotal.toNumber(),
        discountAmount: row.discountAmount.toNumber(),
        ivaPercent: row.ivaPercent.toNumber(),
        ivaAmount: row.ivaAmount.toNumber(),
        total: row.total.toNumber(),
        totalVisualRounded: row.totalVisualRounded.toNumber(),
      })),
      libroNotes.map((row) => ({
        kind: row.kind,
        issuedAt: row.issuedAt,
        invoiceType: row.invoiceType,
        pointOfSale: row.pointOfSale,
        noteNumber: row.noteNumber,
        invoiceNumber: row.invoice.invoiceNumber,
        clientName: row.clientName,
        clientIdentificationType: row.clientIdentificationType,
        clientIdentificationNumber: row.clientIdentificationNumber,
        clientIvaCondition: row.clientIvaCondition,
        netAmount: row.netAmount.toNumber(),
        ivaPercent: row.ivaPercent.toNumber(),
        ivaAmount: row.ivaAmount.toNumber(),
        amount: row.amount.toNumber(),
      })),
    );

    assertDebitBaseProductionIsolation({
      activeEnvironment,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      activeInvoiceIds: productionInvoices.map((row) => row.id),
      dashboardInvoiceIds: metrics.unpaidInvoices.map((row) => row.id),
      debtorSourceInvoiceIds: productionItems.map((row) => row.id),
      movementInvoiceIds: movements.flatMap((row) =>
        [row.invoiceId, ...row.invoices.map((link) => link.id)].filter(
          (id): id is string => id !== null,
        ),
      ),
      libroNumbers: libroRows.flatMap((row) => [row.number, row.associatedNumber]),
    });

    const ticket = await getValidArcaAccessTicket("HOMOLOGACION");
    const last = await getLastAuthorizedVoucher({
      environment: "HOMOLOGACION",
      accessTicket: ticket,
      issuerCuit: emission.issuerCuit,
      pointOfSale: 7,
      voucherType: 1,
    });
    const consulted = await consultVoucher({
      environment: "HOMOLOGACION",
      accessTicket: ticket,
      issuerCuit: emission.issuerCuit,
      pointOfSale: 7,
      voucherType: 1,
      voucherNumber: emission.voucherNumber,
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
      throw new DebitBaseAbort("BillingFiscalSettings cambió durante la verificación.");
    }

    const view: DebitBaseVerifyView = {
      emissionStatus: emission.status,
      environment: emission.environment,
      voucherType: emission.voucherType,
      voucherNumber: emission.voucherNumber,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType,
      pointOfSale: invoice.pointOfSale,
      sequenceNumber: invoice.sequenceNumber,
      paymentMethod: invoice.paymentMethod,
      paymentStatus: invoice.paymentStatus,
      fiscalStatus: invoice.fiscalStatus,
      caePresent: Boolean(invoice.cae?.trim() || emission.authorizationCode?.trim()),
      outstandingCents,
      lastAuthorizedType1: last.lastNumber,
      consultResult: consulted.result,
      consultCaePresent: Boolean(consulted.authorizationCode.trim()),
      consultVoucherNumber: consulted.voucherNumber,
      settingsEnvironment: after.environment,
      isolationConfirmed: true,
    };

    return formatDebitBaseVerify(view, invoice.cae ?? "");
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<number> {
  const args = parseDebitBaseArgs(process.argv.slice(2));
  assertDebitBaseArgs(args);

  if (args.mode === "execute") {
    console.log(`IDEMPOTENCY KEY: ${args.idempotencyKey}`);
    assertDebitBaseCredentialNamesPresent(process.env);
  }

  if (args.mode === "verify") {
    assertDebitBaseCredentialNamesPresent(process.env);
    console.log(await verifyEmission(args.idempotencyKey ?? ""));
    return 0;
  }

  const restoreNetwork = args.mode === "dry-run" ? installNetworkGuard() : null;
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

    if (args.mode === "dry-run") {
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
    }

    const { issueArcaInvoice } = await import(
      "@/server/arca/invoices/issue-arca-invoice"
    );
    const { finalizeApprovedArcaEmission } = await import(
      "@/server/arca/invoices/finalize-approved-arca-emission"
    );
    const { arcaEmissionRepository } = await import(
      "@/server/arca/repositories/arca-emission.repository"
    );
    let report: Awaited<ReturnType<typeof executeDebitBaseInvoice>> | null = null;
    let uncertain = false;

    try {
      report = await executeDebitBaseInvoice(
        intention,
        args.idempotencyKey ?? "",
        settings.issuerCuit,
        {
          issueArcaInvoice,
          finalizeApprovedArcaEmission,
          readRejection: async (emissionId) => {
            const emission = await arcaEmissionRepository.findById(emissionId);
            if (!emission) {
              return [];
            }

            return [...emission.errors, ...emission.observations];
          },
        },
      );
    } catch (error) {
      if (error instanceof DebitBaseAbort) {
        throw error;
      }

      uncertain = true;
    }

    const after = await prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
      select: { environment: true, updatedAt: true },
    });

    if (
      !after ||
      after.environment !== "PRODUCCION" ||
      after.updatedAt.getTime() !== beforeUpdatedAt
    ) {
      throw new DebitBaseAbort("BillingFiscalSettings cambió durante la emisión.");
    }

    if (uncertain || !report) {
      console.log(
        [
          "STATUS: AMBIGUOUS",
          `IDEMPOTENCY KEY: ${args.idempotencyKey}`,
          SAME_KEY_RETRY_MESSAGE,
        ].join("\n"),
      );
      return 2;
    }

    console.log(report.text);
    return report.exitCode;
  } finally {
    restoreNetwork?.();
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
    console.error(`ABORTO: ${redactDebitBaseText(message)}`);
    process.exit(1);
  });
