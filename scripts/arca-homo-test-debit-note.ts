/**
 * Harness de UNA Nota de Débito A de homologación.
 *
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-debit-note.ts --invoice-id=cmuv8gxqo0001c0f0h2ln2fku
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-debit-note.ts --execute --confirm-homologacion --invoice-id=cmuv8gxqo0001c0f0h2ln2fku --idempotency-key=<UUID> --created-by-user-id=<User.id>
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-debit-note.ts --verify --idempotency-key=<UUID>
 *
 * Los imports de base entran después de validar la CLI para abortar
 * antes de abrir Prisma. No hay una dependencia circular.
 */
import { config as loadEnv } from "dotenv";
import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceFiscalStatus,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingPaymentMethod,
  BillingPaymentStatus,
} from "@/generated/prisma/client";
import { invoiceOutstandingCents } from "@/features/billing/utils/invoice-settlement";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";
import {
  assertCashInvoiceRejectsDebit,
  assertDebitNoteAdministrator,
  assertHomoDebitCredentialNamesPresent,
  assertHomoDebitNoteArgs,
  assertHomoDebitNoteProductionIsolation,
  describeHomoDebitNoteDryRun,
  executeHomoDebitNote,
  formatHomoDebitNoteVerify,
  HOMO_DEBIT_NOTE_CASH_INVOICE_ID,
  HOMO_DEBIT_NOTE_INVOICE_ID,
  HomoDebitNoteAbort,
  parseHomoDebitNoteArgs,
  redactDebitNoteText,
  SAME_KEY_RETRY_MESSAGE,
  selectDebitBaseInvoice,
  type HomoDebitNoteInvoice,
  type HomoDebitNoteVerifyView,
} from "./arca-homo-test-debit-note-plan";

loadEnv({ path: ".env", quiet: true });
loadEnv({ path: ".env.local", override: true, quiet: true });

const FISCAL_SETTINGS_ID = "fiscal-settings";

type StoredInvoice = {
  id: string;
  invoiceNumber: string;
  environment: BillingFiscalEnvironment;
  fiscalStatus: BillingInvoiceFiscalStatus;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  sequenceNumber: number;
  issuedAt: Date;
  cae: string | null;
  ivaPercent: { toNumber: () => number };
  paymentMethod: BillingPaymentMethod;
  paymentStatus: BillingPaymentStatus;
  totalVisualRounded: { toNumber: () => number };
  clientId: string | null;
  clientCode: string;
  clientName: string;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
};

const invoiceSelect = {
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
} as const;

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

function toHarnessInvoice(row: StoredInvoice, outstandingCents: number): HomoDebitNoteInvoice {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    environment: row.environment,
    fiscalStatus: row.fiscalStatus,
    invoiceType: row.invoiceType,
    pointOfSale: row.pointOfSale,
    sequenceNumber: row.sequenceNumber,
    issuedAt: row.issuedAt,
    cae: row.cae,
    ivaPercent: row.ivaPercent.toNumber(),
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    totalCents: pesosToCents(row.totalVisualRounded.toNumber()),
    outstandingCents,
    client: {
      id: row.clientId,
      code: row.clientCode,
      name: row.clientName,
      identificationType: row.clientIdentificationType,
      identificationNumber: row.clientIdentificationNumber,
      ivaCondition: row.clientIvaCondition,
    },
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
  const { buildDebtorClients } = await import("@/features/billing/utils/invoice-list");
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

    if (!settings?.issuerCuit?.trim() || settings.environment !== "PRODUCCION") {
      throw new HomoDebitNoteAbort("BillingFiscalSettings no está en PRODUCCION.");
    }

    const beforeUpdatedAt = settings.updatedAt.getTime();
    const activeEnvironment = await readActiveFiscalEnvironment();
    const emission = await arcaEmissionRepository.findByIdempotencyKey(idempotencyKey);

    if (!emission?.noteId || emission.voucherNumber === null) {
      throw new HomoDebitNoteAbort("No hay una emisión completada con esa idempotency key.");
    }

    if (
      emission.status !== "COMPLETED" ||
      emission.environment !== "HOMOLOGACION" ||
      emission.voucherType !== 2 ||
      emission.pointOfSale !== 7
    ) {
      throw new HomoDebitNoteAbort("La emisión no es una Nota de Débito A de HOMOLOGACION.");
    }

    const note = await prisma.billingNote.findUnique({
      where: { id: emission.noteId },
      select: {
        id: true,
        noteNumber: true,
        kind: true,
        fiscalStatus: true,
        environment: true,
        invoiceId: true,
        voucherType: true,
        amount: true,
        cae: true,
        issuedAt: true,
      },
    });
    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: HOMO_DEBIT_NOTE_INVOICE_ID },
      select: {
        id: true,
        invoiceNumber: true,
        fiscalStatus: true,
        paymentMethod: true,
        paymentStatus: true,
        totalVisualRounded: true,
        issuedAt: true,
      },
    });
    const [credits, debits, allocated, noteCount] = await Promise.all([
      prisma.billingNote.aggregate({
        where: {
          invoiceId: HOMO_DEBIT_NOTE_INVOICE_ID,
          kind: "CREDIT",
          fiscalStatus: "AUTORIZADA",
        },
        _sum: { amount: true },
      }),
      prisma.billingNote.aggregate({
        where: {
          invoiceId: HOMO_DEBIT_NOTE_INVOICE_ID,
          kind: "DEBIT",
          fiscalStatus: "AUTORIZADA",
        },
        _sum: { amount: true },
      }),
      prisma.billingReceiptAllocation.aggregate({
        where: { invoiceId: HOMO_DEBIT_NOTE_INVOICE_ID },
        _sum: { amount: true },
      }),
      prisma.billingNote.count({
        where: { invoiceId: HOMO_DEBIT_NOTE_INVOICE_ID },
      }),
    ]);

    if (!note || !invoice || note.invoiceId !== invoice.id || noteCount !== 1) {
      throw new HomoDebitNoteAbort("La emisión no tiene exactamente una nota sobre la factura base.");
    }

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
    const range = libroIvaMonthRange(note.issuedAt.getFullYear(), note.issuedAt.getMonth() + 1);
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

    assertHomoDebitNoteProductionIsolation({
      activeEnvironment,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      noteId: note.id,
      noteNumber: note.noteNumber,
      activeInvoiceIds: productionInvoices.map((row) => row.id),
      productionNoteIds: productionNotes.map((row) => row.id),
      dashboardInvoiceIds: metrics.unpaidInvoices.map((row) => row.id),
      debtorSourceInvoiceIds: productionItems.map((row) => row.id),
      movementIds: movements.map((row) => row.id),
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
      voucherType: 2,
    });
    const consulted = await consultVoucher({
      environment: "HOMOLOGACION",
      accessTicket: ticket,
      issuerCuit: emission.issuerCuit,
      pointOfSale: 7,
      voucherType: 2,
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
      throw new HomoDebitNoteAbort("BillingFiscalSettings cambió durante la verificación.");
    }

    const view: HomoDebitNoteVerifyView = {
      emissionStatus: emission.status,
      emissionEnvironment: emission.environment,
      voucherType: emission.voucherType,
      voucherNumber: emission.voucherNumber,
      noteId: note.id,
      noteNumber: note.noteNumber,
      noteKind: note.kind,
      noteFiscalStatus: note.fiscalStatus,
      noteEnvironment: note.environment,
      noteInvoiceId: note.invoiceId,
      noteVoucherType: note.voucherType,
      noteAmountCents: pesosToCents(note.amount.toNumber()),
      caePresent: Boolean(note.cae?.trim() || emission.authorizationCode?.trim()),
      invoiceNumber: invoice.invoiceNumber,
      invoiceFiscalStatus: invoice.fiscalStatus,
      invoicePaymentMethod: invoice.paymentMethod,
      invoicePaymentStatus: invoice.paymentStatus,
      invoiceNoteCount: noteCount,
      outstandingCents,
      lastAuthorizedType2: last.lastNumber,
      consultResult: consulted.result,
      consultCaePresent: Boolean(consulted.authorizationCode.trim()),
      consultVoucherNumber: consulted.voucherNumber,
      settingsEnvironment: after.environment,
      isolationConfirmed: true,
    };

    return formatHomoDebitNoteVerify(view, note.cae ?? emission.authorizationCode ?? "");
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<number> {
  const args = parseHomoDebitNoteArgs(process.argv.slice(2));
  assertHomoDebitNoteArgs(args);

  if (args.mode === "execute") {
    console.log(`IDEMPOTENCY KEY: ${args.idempotencyKey}`);
    assertHomoDebitCredentialNamesPresent(process.env);
  }

  if (args.mode === "verify") {
    assertHomoDebitCredentialNamesPresent(process.env);
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
      select: invoiceSelect,
    });
    const cash = await prisma.billingInvoice.findUnique({
      where: { id: HOMO_DEBIT_NOTE_CASH_INVOICE_ID },
      select: invoiceSelect,
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
    const invoice = toHarnessInvoice(
      stored,
      invoiceOutstandingCents(
        pesosToCents(stored.totalVisualRounded.toNumber()),
        pesosToCents(credits._sum.amount?.toNumber() ?? 0),
        pesosToCents(debits._sum.amount?.toNumber() ?? 0),
        pesosToCents(allocated._sum.amount?.toNumber() ?? 0),
      ),
    );
    const beforeUpdatedAt = settings.updatedAt.getTime();

    assertCashInvoiceRejectsDebit(toHarnessInvoice(cash, 0));

    if (args.mode === "dry-run") {
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
    }

    const user = await prisma.user.findUnique({
      where: { id: args.createdByUserId ?? "" },
      select: { id: true, role: true, status: true },
    });

    assertDebitNoteAdministrator(user);

    if (!user) {
      throw new HomoDebitNoteAbort("El usuario no es un administrador activo.");
    }

    const { issueArcaNote } = await import("@/server/arca/notes/issue-arca-note");
    const { loadHomologationNoteEmissionSource } = await import(
      "@/server/arca/notes/note-emission-source"
    );
    const { arcaEmissionRepository } = await import(
      "@/server/arca/repositories/arca-emission.repository"
    );
    let report: Awaited<ReturnType<typeof executeHomoDebitNote>> | null = null;
    let uncertain = false;

    try {
      report = await executeHomoDebitNote(
        {
          invoice,
          issuerCuit: settings.issuerCuit,
          idempotencyKey: args.idempotencyKey ?? "",
          createdByUserId: user.id,
        },
        {
          issueArcaNote,
          loadSource: loadHomologationNoteEmissionSource,
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
      if (error instanceof HomoDebitNoteAbort) {
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
      throw new HomoDebitNoteAbort("BillingFiscalSettings cambió durante la emisión.");
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
    if (error instanceof HomoDebitNoteAbort) {
      console.error(`ABORTO: ${error.message}`);
      process.exit(error.exitCode);
    }

    const message = error instanceof Error ? error.message : "error";
    console.error(`ABORTO: ${redactDebitNoteText(message)}`);
    process.exit(1);
  });
