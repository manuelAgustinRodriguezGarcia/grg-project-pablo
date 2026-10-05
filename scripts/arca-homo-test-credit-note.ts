/**
 * Harness de UNA Nota de Crédito A de homologación.
 *
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-credit-note.ts --invoice-id=<BillingInvoice.id>
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-credit-note.ts --execute --confirm-homologacion --invoice-id=<BillingInvoice.id> --idempotency-key=<UUID> --created-by-user-id=<User.id>
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-credit-note.ts --verify --idempotency-key=<UUID>
 */
import { config as loadEnv } from "dotenv";
import { invoiceOutstandingCents } from "@/features/billing/utils/invoice-settlement";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";
import {
  assertHomoCredentialNamesPresent,
  assertHomoCreditNoteArgs,
  assertHomoCreditNoteInvoice,
  describeHomoCreditNoteDryRun,
  executeHomoCreditNote,
  formatHomoCreditNoteVerify,
  HOMO_CREDIT_NOTE_INVOICE_ID,
  HomoCreditNoteAbort,
  parseHomoCreditNoteArgs,
  redactCreditNoteText,
  SAME_KEY_RETRY_MESSAGE,
  type HomoCreditNoteVerifyView,
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

async function verifyEmission(idempotencyKey: string): Promise<string> {
  const { prisma } = await import("@/server/database/prisma");
  const { arcaEmissionRepository } = await import(
    "@/server/arca/repositories/arca-emission.repository"
  );
  const { getValidArcaAccessTicket } = await import(
    "@/server/arca/tickets/access-ticket"
  );
  const { consultVoucher, getLastAuthorizedVoucher } = await import(
    "@/server/arca/wsfe/wsfe-client"
  );

  try {
    const emission = await arcaEmissionRepository.findByIdempotencyKey(idempotencyKey);

    if (!emission) {
      throw new HomoCreditNoteAbort("No hay una emisión con esa idempotency key.");
    }

    if (emission.environment !== "HOMOLOGACION" || emission.voucherType !== 3) {
      throw new HomoCreditNoteAbort("La emisión no es una Nota de Crédito A de HOMOLOGACION.");
    }

    if (emission.pointOfSale !== 7) {
      throw new HomoCreditNoteAbort("El punto de venta no es 7.");
    }

    const note = emission.noteId
      ? await prisma.billingNote.findUnique({
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
          },
        })
      : null;
    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: HOMO_CREDIT_NOTE_INVOICE_ID },
      select: {
        id: true,
        fiscalStatus: true,
        totalVisualRounded: true,
        paymentMethod: true,
      },
    });
    const [credits, debits, allocated, noteCount] = await Promise.all([
      prisma.billingNote.aggregate({
        where: {
          invoiceId: HOMO_CREDIT_NOTE_INVOICE_ID,
          kind: "CREDIT",
          fiscalStatus: "AUTORIZADA",
        },
        _sum: { amount: true },
      }),
      prisma.billingNote.aggregate({
        where: {
          invoiceId: HOMO_CREDIT_NOTE_INVOICE_ID,
          kind: "DEBIT",
          fiscalStatus: "AUTORIZADA",
        },
        _sum: { amount: true },
      }),
      prisma.billingReceiptAllocation.aggregate({
        where: { invoiceId: HOMO_CREDIT_NOTE_INVOICE_ID },
        _sum: { amount: true },
      }),
      prisma.billingNote.count({
        where: { invoiceId: HOMO_CREDIT_NOTE_INVOICE_ID },
      }),
    ]);
    const invoiceTotalCents = invoice
      ? pesosToCents(invoice.totalVisualRounded.toNumber())
      : null;
    const creditCents = pesosToCents(credits._sum.amount?.toNumber() ?? 0);
    const debitCents = pesosToCents(debits._sum.amount?.toNumber() ?? 0);
    const allocatedCents = pesosToCents(allocated._sum.amount?.toNumber() ?? 0);
    const noteAmountCents = note ? pesosToCents(note.amount.toNumber()) : null;
    const outstandingCents =
      invoiceTotalCents === null
        ? null
        : invoiceOutstandingCents(
            invoiceTotalCents,
            creditCents,
            debitCents,
            allocatedCents,
          );
    const saldoReflejaNc =
      note?.kind === "CREDIT" &&
      note.fiscalStatus === "AUTORIZADA" &&
      noteAmountCents === 12_100 &&
      creditCents >= 12_100 &&
      outstandingCents !== null &&
      invoiceTotalCents !== null &&
      outstandingCents ===
        invoiceOutstandingCents(
          invoiceTotalCents,
          creditCents,
          debitCents,
          allocatedCents,
        ) &&
      outstandingCents < invoiceTotalCents;
    const ticket = await getValidArcaAccessTicket("HOMOLOGACION");
    const last = await getLastAuthorizedVoucher({
      environment: "HOMOLOGACION",
      accessTicket: ticket,
      issuerCuit: emission.issuerCuit,
      pointOfSale: 7,
      voucherType: 3,
    });
    let consultResult: "A" | "R" | null = null;
    let consultCaePresent = false;
    let consultVoucherNumber: number | null = null;

    if (emission.voucherNumber !== null) {
      const consulted = await consultVoucher({
        environment: "HOMOLOGACION",
        accessTicket: ticket,
        issuerCuit: emission.issuerCuit,
        pointOfSale: 7,
        voucherType: 3,
        voucherNumber: emission.voucherNumber,
      });
      consultResult = consulted.result;
      consultCaePresent = Boolean(consulted.authorizationCode.trim());
      consultVoucherNumber = consulted.voucherNumber;
    }

    const view: HomoCreditNoteVerifyView = {
      emissionStatus: emission.status,
      emissionEnvironment: emission.environment,
      voucherType: emission.voucherType,
      voucherNumber: emission.voucherNumber,
      noteId: note?.id ?? null,
      noteNumber: note?.noteNumber ?? null,
      noteKind: note?.kind ?? null,
      noteFiscalStatus: note?.fiscalStatus ?? null,
      noteEnvironment: note?.environment ?? null,
      noteInvoiceId: note?.invoiceId ?? null,
      noteVoucherType: note?.voucherType ?? null,
      noteAmountCents,
      caePresent: Boolean(note?.cae?.trim() || emission.authorizationCode?.trim()),
      invoiceFiscalStatus: invoice?.fiscalStatus ?? null,
      invoiceNoteCount: noteCount,
      outstandingCents,
      saldoReflejaNc,
      lastAuthorizedType3: last.lastNumber,
      consultResult,
      consultCaePresent,
      consultVoucherNumber,
    };

    return formatHomoCreditNoteVerify(view);
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<number> {
  const args = parseHomoCreditNoteArgs(process.argv.slice(2));
  assertHomoCreditNoteArgs(args);

  if (args.mode === "execute") {
    console.log(`IDEMPOTENCY KEY: ${args.idempotencyKey}`);
    assertHomoCredentialNamesPresent(process.env);
  }

  if (args.mode === "verify") {
    assertHomoCredentialNamesPresent(process.env);
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
      throw new HomoCreditNoteAbort("La configuración fiscal no tiene CUIT de emisor.");
    }

    if (args.invoiceId !== HOMO_CREDIT_NOTE_INVOICE_ID) {
      throw new HomoCreditNoteAbort("Esta prueba solo admite la factura de homologación indicada.");
    }

    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: args.invoiceId },
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
    const prepared = invoice
      ? { ...invoice, ivaPercent: invoice.ivaPercent.toNumber() }
      : null;

    assertHomoCreditNoteInvoice(prepared);
    const summary = describeHomoCreditNoteDryRun({
      invoice: prepared,
      issuerCuit: settings.issuerCuit,
      settingsEnvironment: settings.environment,
      settingsUpdatedAt: settings.updatedAt.toISOString(),
    });

    if (args.mode === "dry-run") {
      console.log(JSON.stringify(summary, null, 2));
      return 0;
    }

    const user = await prisma.user.findUnique({
      where: { id: args.createdByUserId ?? "" },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.role !== "ADMINISTRADOR" || user.status !== "ACTIVE") {
      throw new HomoCreditNoteAbort("El usuario no es un administrador activo.");
    }

    const beforeUpdatedAt = settings.updatedAt.getTime();
    const persistedEnvironment = settings.environment;
    const { issueArcaNote } = await import("@/server/arca/notes/issue-arca-note");
    const { loadHomologationNoteEmissionSource } = await import(
      "@/server/arca/notes/note-emission-source"
    );
    const { arcaEmissionRepository } = await import(
      "@/server/arca/repositories/arca-emission.repository"
    );

    let report: Awaited<ReturnType<typeof executeHomoCreditNote>> | null = null;
    let uncertain = false;

    try {
      report = await executeHomoCreditNote(
        {
          invoiceId: args.invoiceId,
          idempotencyKey: args.idempotencyKey ?? "",
          createdByUserId: user.id,
          associatedInvoiceNumber: invoice?.invoiceNumber ?? "",
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
      if (error instanceof HomoCreditNoteAbort) {
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
      after.environment !== persistedEnvironment ||
      after.updatedAt.getTime() !== beforeUpdatedAt
    ) {
      throw new HomoCreditNoteAbort("BillingFiscalSettings cambió durante la emisión.");
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
    if (error instanceof HomoCreditNoteAbort) {
      console.error(`ABORTO: ${error.message}`);
      process.exit(error.exitCode);
    }

    const message = error instanceof Error ? error.message : "error";
    console.error(`ABORTO: ${redactCreditNoteText(message)}`);
    process.exit(1);
  });
