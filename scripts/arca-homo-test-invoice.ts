/**
 * Harness de UNA Factura B de homologación.
 *
 * Dry-run (default): no WSAA, no WSFE, no escrituras.
 * --execute queda bloqueado: el finalizador exige un BillingClient real.
 *
 *   pnpm exec tsx --conditions=react-server scripts/arca-homo-test-invoice.ts
 */
import { config as loadEnv } from "dotenv";
import {
  ARCA_CURRENCY_ID,
  ARCA_CURRENCY_RATE,
  ARCA_DOCUMENT_TYPE,
  ARCA_VOUCHER_TYPE,
} from "@/shared/fiscal/arca-fiscal-mapping";
import {
  computeInvoiceTotals,
  pesosToCents,
} from "@/shared/utils/billing-invoice-totals";
import { paymentStatusForMethod } from "@/shared/utils/billing-invoice-rules";

loadEnv({ path: ".env", quiet: true });
loadEnv({ path: ".env.local", override: true, quiet: true });

const ENVIRONMENT = "HOMOLOGACION" as const;
const FISCAL_SETTINGS_ID = "fiscal-settings";
const SIMULATED_VOUCHER_NUMBER = 1;
const CLIENT_NAME = "CONSUMIDOR FINAL HOMOLOGACION";
const ITEM_DESCRIPTION = "PRUEBA HOMOLOGACION NC ND";
const IVA_PERCENT = 21;
const GROSS_PESOS = 1210;
const EXPECTED_NET_PESOS = 1000;
const EXPECTED_VAT_PESOS = 210;
const EXPECTED_TOTAL_PESOS = 1210;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXECUTION_BLOCKERS = [
  "El finalizador exige un BillingClient real: canonicalizeBillingPayload rechaza client.id vacío y buildApprovedInvoiceWrite persiste billing.client.id como FK de BillingInvoice.clientId.",
] as const;

type CliArgs = {
  execute: boolean;
  idempotencyKey: string | null;
};

function abort(message: string): never {
  console.error(`ABORTO: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  let execute = false;
  let idempotencyKey: string | null = null;

  for (const arg of argv) {
    if (arg === "--execute") {
      execute = true;
      continue;
    }

    if (arg.startsWith("--idempotency-key=")) {
      idempotencyKey = arg.slice("--idempotency-key=".length);
      continue;
    }

    if (
      arg.includes("ARCA_PROD_CERT_B64") ||
      arg.includes("ARCA_PROD_PRIVATE_KEY_B64") ||
      arg.includes("PRODUCCION")
    ) {
      abort("El harness solo puede apuntar a HOMOLOGACION.");
    }

    abort(`Argumento no reconocido: ${arg}`);
  }

  return { execute, idempotencyKey };
}

function installNetworkGuard(): { calls: () => number } {
  let calls = 0;
  const guardedFetch: typeof fetch = async (input) => {
    calls += 1;
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    throw new Error(`Red bloqueada en dry-run: ${url}`);
  };

  globalThis.fetch = guardedFetch;
  return { calls: () => calls };
}

function pesos(cents: number): string {
  return (cents / 100).toFixed(2);
}

async function main(): Promise<void> {
  const network = installNetworkGuard();
  const args = parseArgs(process.argv.slice(2));

  if (ENVIRONMENT !== "HOMOLOGACION") {
    abort("El environment del harness no es HOMOLOGACION.");
  }

  if (args.execute) {
    if (
      args.idempotencyKey !== null &&
      !UUID_PATTERN.test(args.idempotencyKey)
    ) {
      abort("La idempotencyKey tiene que ser un UUID.");
    }

    console.error("EJECUCION DETENIDA.");
    console.error(
      "No se llamó a issueArcaInvoice, WSAA, WSFE ni a la base de datos.",
    );
    for (const blocker of EXECUTION_BLOCKERS) {
      console.error(`- ${blocker}`);
    }
    console.error(
      "Cuando esos bloqueos se resuelvan, --execute exigirá --idempotency-key=<UUID> y no generará una key nueva.",
    );
    process.exit(2);
  }

  const { prisma } = await import("@/server/database/prisma");
  const { parseArcaPointOfSale } = await import(
    "@/server/arca/utils/point-of-sale"
  );
  const { buildArcaCaeRequest } = await import(
    "@/server/arca/adapters/billing-invoice-to-cae"
  );
  const { canonicalizeBillingPayload } = await import(
    "@/server/arca/invoices/billing-payload-snapshot"
  );

  try {
    const settings = await prisma.billingFiscalSettings.findUnique({
      where: { id: FISCAL_SETTINGS_ID },
      select: {
        environment: true,
        pointOfSale: true,
        ivaPercent: true,
        issuerName: true,
        issuerCuit: true,
        issuerAddress: true,
        issuerCity: true,
        issuerProvince: true,
        issuerIvaCondition: true,
        issuerGrossIncome: true,
        issuerActivitiesStartedAt: true,
        updatedAt: true,
      },
    });

    if (!settings) {
      abort("No existe la fila BillingFiscalSettings. No se crea.");
    }

    if (!settings.issuerCuit?.trim()) {
      abort("La configuración fiscal no tiene CUIT de emisor.");
    }

    const pointOfSale = parseArcaPointOfSale(settings.pointOfSale);
    const unitPriceCents = pesosToCents(GROSS_PESOS);
    const totals = computeInvoiceTotals({
      invoiceType: "B",
      items: [{ quantity: 1, unitPriceCents }],
      ivaPercent: IVA_PERCENT,
      discountPercent: 0,
    });

    if (
      pesos(totals.netCents) !== EXPECTED_NET_PESOS.toFixed(2) ||
      pesos(totals.ivaCents) !== EXPECTED_VAT_PESOS.toFixed(2) ||
      pesos(totals.totalCents) !== EXPECTED_TOTAL_PESOS.toFixed(2)
    ) {
      abort("computeInvoiceTotals no cerró 1000.00 + 210.00 = 1210.00.");
    }

    const paymentMethod = "CONTADO" as const;
    const commercialPayload = {
      issuedAt: new Date().toISOString(),
      pointOfSale,
      invoiceType: "B" as const,
      client: {
        id: "",
        code: "CF-HOMO",
        name: CLIENT_NAME,
        identificationType: "NINGUNO" as const,
        identificationNumber: null,
        ivaCondition: "CONSUMIDOR_FINAL" as const,
      },
      items: [
        {
          rubroId: null,
          rubroCode: "HOMO",
          rubroName: "Homologación",
          description: ITEM_DESCRIPTION,
          quantity: 1,
          unitPriceCents,
          lineTotalCents: totals.lineTotalsCents[0] ?? 0,
          sortOrder: 0,
        },
      ],
      financial: {
        subtotalCents: totals.subtotalCents,
        discountPercent: 0,
        discountAmountCents: totals.discountCents,
        ivaPercent: IVA_PERCENT,
        ivaAmountCents: totals.ivaCents,
        totalCents: totals.totalCents,
        totalVisualRoundedCents: totals.totalVisualRoundedCents,
        netCents: totals.netCents,
        nonTaxedCents: 0,
        exemptCents: 0,
        taxCents: 0,
      },
      paymentMethod,
      paymentStatus: paymentStatusForMethod(paymentMethod),
      notes: null,
    };

    let snapshotError = "";
    try {
      canonicalizeBillingPayload(commercialPayload);
    } catch (error) {
      snapshotError = error instanceof Error ? error.message : "snapshot inválido";
    }

    if (!snapshotError) {
      abort("El snapshot aceptó un cliente sin id. Eso no era lo esperado.");
    }

    let rubroSnapshotAccepted = false;
    try {
      canonicalizeBillingPayload({
        ...commercialPayload,
        client: {
          ...commercialPayload.client,
          id: "solo-validacion-en-memoria",
        },
      });
      rubroSnapshotAccepted = true;
    } catch {
      rubroSnapshotAccepted = false;
    }

    const request = buildArcaCaeRequest({
      environment: ENVIRONMENT,
      issuerCuit: settings.issuerCuit,
      pointOfSale,
      voucherNumber: SIMULATED_VOUCHER_NUMBER,
      voucherDate: commercialPayload.issuedAt,
      client: {
        identificationType: "NINGUNO",
        identificationNumber: null,
        ivaCondition: "CONSUMIDOR_FINAL",
      },
      invoiceType: "B",
      totals: {
        netCents: totals.netCents,
        vatCents: totals.ivaCents,
        totalCents: totals.totalCents,
        nonTaxedCents: 0,
        exemptCents: 0,
        taxCents: 0,
        totalVisualRoundedCents: totals.totalVisualRoundedCents,
      },
      ivaPercent: IVA_PERCENT,
    });

    if (request.environment !== "HOMOLOGACION") {
      abort("El request no quedó en HOMOLOGACION.");
    }

    if (request.voucherType !== ARCA_VOUCHER_TYPE.FACTURA_B) {
      abort("El request no es Factura B tipo 6.");
    }

    if (request.currencyId !== ARCA_CURRENCY_ID || request.currencyRate !== ARCA_CURRENCY_RATE) {
      abort("La moneda del request no es PES con cotización 1.");
    }

    if (
      request.documentType !== ARCA_DOCUMENT_TYPE.NINGUNO ||
      request.documentNumber !== 0
    ) {
      abort("El receptor no quedó como consumidor final sin documento.");
    }

    const summary = {
      modo: "dry-run",
      environment: request.environment,
      billingFiscalSettings: {
        environmentPersistido: settings.environment,
        updatedAt: settings.updatedAt.toISOString(),
        modificado: false,
      },
      invoiceType: "B",
      voucherType: request.voucherType,
      pointOfSale: request.pointOfSale,
      voucherNumberSimulado: request.voucherFrom,
      voucherNumberEsFiscal: false,
      cliente: CLIENT_NAME,
      identificacion: "NINGUNO",
      condicionIva: "CONSUMIDOR_FINAL",
      documentType: request.documentType,
      documentNumber: request.documentNumber,
      detalle: ITEM_DESCRIPTION,
      cantidad: 1,
      neto: pesos(totals.netCents),
      iva: pesos(totals.ivaCents),
      total: pesos(totals.totalCents),
      ivaPercent: IVA_PERCENT,
      moneda: request.currencyId,
      cotizacion: request.currencyRate,
      formaDePago: paymentMethod,
      paymentStatus: commercialPayload.paymentStatus,
      rubroId: null,
      rubroSnapshotAceptado: rubroSnapshotAccepted,
      rubroSnapshot: "HOMO / Homologación",
      emisor: {
        razonSocial: settings.issuerName,
        cuitPresente: true,
        domicilio: settings.issuerAddress,
        localidad: settings.issuerCity,
        provincia: settings.issuerProvince,
        condicionIva: settings.issuerIvaCondition,
        iibb: settings.issuerGrossIncome,
        inicioActividades: settings.issuerActivitiesStartedAt,
        puntoDeVentaTexto: settings.pointOfSale,
        alicuotaPersistida: settings.ivaPercent.toString(),
      },
      snapshotCliente: snapshotError,
      idempotencyKey: "no usada; --execute exige --idempotency-key=<UUID> y no genera una",
      credencialesProdLeidas: false,
      bloqueosExecute: EXECUTION_BLOCKERS,
      red: network.calls(),
      wsaa: 0,
      wsfe: 0,
      escriturasDb: 0,
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main();
