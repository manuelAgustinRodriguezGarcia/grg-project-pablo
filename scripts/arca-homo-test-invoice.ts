/**
 * Harness de UNA Factura A de homologación.
 *
 * La letra sale del BillingClient. Dry-run y --execute arman la misma intención.
 * --execute llama a issueArcaInvoice con environment HOMOLOGACION.
 * El número fiscal lo asigna el motor: FECompUltimoAutorizado last + 1.
 *
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-invoice.ts --client-id=<BillingClient.id>
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-invoice.ts --execute --confirm-homologacion --client-id=<BillingClient.id> --idempotency-key=<UUID>
 *   pnpm dlx tsx --conditions=react-server scripts/arca-homo-test-invoice.ts --verify --idempotency-key=<UUID>
 */
import { config as loadEnv } from "dotenv";
import {
  assertHomoCredentialNamesPresent,
  assertHomoHarnessArgs,
  buildHomoInvoiceIntention,
  describeHomoDryRun,
  executeHomoHarness,
  formatHomoVerify,
  HomoHarnessAbort,
  parseHomoHarnessArgs,
  redactHarnessText,
  type HomoVerifyArca,
  type HomoVerifyLocal,
} from "./arca-homo-test-invoice-plan";

loadEnv({ path: ".env", quiet: true });
loadEnv({ path: ".env.local", override: true, quiet: true });

const FISCAL_SETTINGS_ID = "fiscal-settings";

function installNetworkGuard(): { calls: () => number; restore: () => void } {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls += 1;
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    throw new Error(`Red bloqueada en dry-run: ${url}`);
  };

  return {
    calls: () => calls,
    restore: () => {
      globalThis.fetch = original;
    },
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
    const emission = await arcaEmissionRepository.findByIdempotencyKey(
      idempotencyKey,
    );

    if (!emission) {
      throw new HomoHarnessAbort("No hay una emisión con esa idempotency key.");
    }

    if (emission.environment !== "HOMOLOGACION" || emission.voucherType !== 1) {
      throw new HomoHarnessAbort("La emisión no es una Factura A de HOMOLOGACION.");
    }

    const invoice = emission.invoiceId
      ? await prisma.billingInvoice.findUnique({
          where: { id: emission.invoiceId },
          select: {
            id: true,
            invoiceNumber: true,
            environment: true,
            fiscalStatus: true,
            cae: true,
          },
        })
      : null;

    const local: HomoVerifyLocal = {
      emissionStatus: emission.status,
      emissionEnvironment: emission.environment,
      voucherType: emission.voucherType,
      voucherNumber: emission.voucherNumber,
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.invoiceNumber ?? null,
      invoiceEnvironment: invoice?.environment ?? null,
      fiscalStatus: invoice?.fiscalStatus ?? null,
      caePresent: Boolean(invoice?.cae?.trim() || emission.authorizationCode?.trim()),
    };

    const ticket = await getValidArcaAccessTicket("HOMOLOGACION");
    const last = await getLastAuthorizedVoucher({
      environment: "HOMOLOGACION",
      accessTicket: ticket,
      issuerCuit: emission.issuerCuit,
      pointOfSale: emission.pointOfSale,
      voucherType: 1,
    });

    let arca: HomoVerifyArca = {
      lastAuthorizedType1: last.lastNumber,
      consultResult: null,
      consultCaePresent: false,
      consultVoucherNumber: null,
    };

    if (emission.voucherNumber !== null) {
      const consulted = await consultVoucher({
        environment: "HOMOLOGACION",
        accessTicket: ticket,
        issuerCuit: emission.issuerCuit,
        pointOfSale: emission.pointOfSale,
        voucherType: 1,
        voucherNumber: emission.voucherNumber,
      });
      arca = {
        lastAuthorizedType1: last.lastNumber,
        consultResult: consulted.result,
        consultCaePresent: Boolean(consulted.authorizationCode.trim()),
        consultVoucherNumber: consulted.voucherNumber,
      };
    }

    return formatHomoVerify(local, arca);
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<number> {
  const args = parseHomoHarnessArgs(process.argv.slice(2));
  assertHomoHarnessArgs(args);

  if (args.mode === "execute") {
    console.log(`IDEMPOTENCY KEY: ${args.idempotencyKey}`);
    assertHomoCredentialNamesPresent(process.env);
  }

  if (args.mode === "verify") {
    assertHomoCredentialNamesPresent(process.env);
    const text = await verifyEmission(args.idempotencyKey ?? "");
    console.log(text);
    return 0;
  }

  const network = args.mode === "dry-run" ? installNetworkGuard() : null;
  const { prisma } = await import("@/server/database/prisma");

  try {
    const settings = await prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
    });

    if (!settings) {
      throw new HomoHarnessAbort("No existe la fila BillingFiscalSettings. No se crea.");
    }

    const client = await prisma.billingClient.findUnique({
      where: { id: args.clientId ?? "" },
    });

    if (!client) {
      throw new HomoHarnessAbort("Cliente no encontrado.");
    }

    const issuedAt = new Date();
    const beforeUpdatedAt = settings.updatedAt.getTime();
    const persistedEnvironment = settings.environment;
    const intention = buildHomoInvoiceIntention({
      client,
      settings,
      issuedAt,
    });

    if (args.mode === "dry-run") {
      const summary = describeHomoDryRun({
        intention,
        issuerCuit: settings.issuerCuit ?? "",
        pointOfSaleText: settings.pointOfSale,
        settingsEnvironment: settings.environment,
        settingsUpdatedAt: settings.updatedAt.toISOString(),
        networkCalls: network?.calls() ?? 0,
      });
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
    const report = await executeHomoHarness(
      intention,
      args.idempotencyKey ?? "",
      settings.issuerCuit ?? "",
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
    const after = await prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
      select: { environment: true, updatedAt: true },
    });

    if (
      !after ||
      after.environment !== persistedEnvironment ||
      after.updatedAt.getTime() !== beforeUpdatedAt
    ) {
      throw new HomoHarnessAbort(
        "BillingFiscalSettings cambió durante la emisión.",
      );
    }

    console.log(report.text);
    return report.exitCode;
  } finally {
    network?.restore();
    await prisma.$disconnect();
  }
}

void main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error: unknown) => {
    if (error instanceof HomoHarnessAbort) {
      console.error(`ABORTO: ${error.message}`);
      process.exit(error.exitCode);
    }

    const message = error instanceof Error ? error.message : "error";
    console.error(`ABORTO: ${redactHarnessText(message)}`);
    process.exit(1);
  });
