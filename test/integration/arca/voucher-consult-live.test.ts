import { describe, it } from "vitest";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import { getValidArcaAccessTicket } from "@/server/arca/tickets/access-ticket";
import { toFiscalCents } from "@/server/arca/wsfe/wsfe-cae-request";
import { consultVoucher } from "@/server/arca/wsfe/wsfe-client";
import { loadNextLocalEnv } from "./load-next-env";
import { resolveLiveIssuerCuit } from "./wsfe-live-issuer";

const REQUIRED_ENV = ["ARCA_HOMO_CERT_B64", "ARCA_TICKET_ENCRYPTION_KEY_B64"] as const;
const LIVE_ENABLED = process.env.ARCA_VOUCHER_CONSULT_LIVE_TEST === "1";
const POINT_OF_SALE = 7;
const VOUCHER_TYPE = 6;
const VOUCHER_NUMBER = 2;

function missingCredentialNames(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
}

async function readIssuerCuit(): Promise<{ issuerCuit: string | null } | null> {
  const { BILLING_FISCAL_SETTINGS_ID } = await import(
    "@/server/repositories/billing-fiscal-settings.repository"
  );
  const { prisma } = await import("@/server/database/prisma");

  try {
    return await prisma.billingFiscalSettings.findUnique({
      where: { id: BILLING_FISCAL_SETTINGS_ID },
      select: { issuerCuit: true },
    });
  } catch {
    throw new Error(
      "No se pudo leer BillingFiscalSettings. No se realizó ninguna llamada de red.",
    );
  }
}

function formatThrown(error: unknown): string {
  if (
    error instanceof ArcaWsfeError ||
    error instanceof ArcaConfigurationError ||
    error instanceof ArcaTicketCacheError ||
    error instanceof ArcaWsaaError
  ) {
    return ["ARCA VOUCHER CONSULT HOMOLOGACION ERROR", `code: ${error.code}`, "No se reintentó."].join(
      "\n",
    );
  }

  if (error instanceof Error && error.message.startsWith("ARCA")) {
    return error.message;
  }

  if (error instanceof Error && error.message.startsWith("BillingFiscalSettings")) {
    return error.message;
  }

  if (error instanceof Error && error.message.startsWith("No se pudo leer BillingFiscalSettings")) {
    return error.message;
  }

  if (error instanceof Error && error.message.startsWith("Faltan variables")) {
    return error.message;
  }

  return ["ARCA VOUCHER CONSULT HOMOLOGACION ERROR", "code: UNEXPECTED", "No se reintentó."].join(
    "\n",
  );
}

function fail(error: unknown): never {
  const safe = formatThrown(error);
  console.log(safe);
  throw new Error(safe);
}

describe.skipIf(!LIVE_ENABLED)("consulta de comprobante en homologación", () => {
  it("consulta la Factura B 0007-00000002 ya autorizada", async () => {
    loadNextLocalEnv();

    let issuerCuit: string;

    try {
      issuerCuit = resolveLiveIssuerCuit(await readIssuerCuit());
    } catch (error) {
      fail(error);
    }

    const missing = missingCredentialNames();

    if (missing.length > 0) {
      fail(
        new Error(
          `Faltan variables para la consulta live: ${missing.join(", ")}. No se realizó ninguna llamada de red.`,
        ),
      );
    }

    try {
      const accessTicket = await getValidArcaAccessTicket("HOMOLOGACION");
      const voucher = await consultVoucher({
        environment: "HOMOLOGACION",
        accessTicket,
        issuerCuit,
        pointOfSale: POINT_OF_SALE,
        voucherType: VOUCHER_TYPE,
        voucherNumber: VOUCHER_NUMBER,
      });
      const authorizationPresent = voucher.authorizationCode.trim().length > 0;
      const matches =
        voucher.pointOfSale === POINT_OF_SALE &&
        voucher.voucherType === VOUCHER_TYPE &&
        voucher.voucherNumber === VOUCHER_NUMBER &&
        toFiscalCents(voucher.totalAmount) === toFiscalCents(1210) &&
        toFiscalCents(voucher.netAmount) === toFiscalCents(1000) &&
        toFiscalCents(voucher.vatAmount) === toFiscalCents(210) &&
        authorizationPresent &&
        voucher.emissionType === "CAE";

      if (!matches) {
        throw new Error(
          [
            "ARCA VOUCHER CONSULT HOMOLOGACION MISMATCH",
            `pointOfSale: ${voucher.pointOfSale}`,
            `voucherType: ${voucher.voucherType}`,
            `voucherNumber: ${voucher.voucherNumber}`,
            `total: ${voucher.totalAmount}`,
            `net: ${voucher.netAmount}`,
            `vat: ${voucher.vatAmount}`,
            `authorizationPresent: ${authorizationPresent}`,
            `emissionType: ${voucher.emissionType}`,
            "No se emitió ningún comprobante.",
          ].join("\n"),
        );
      }

      console.log(
        [
          "ARCA VOUCHER CONSULT HOMOLOGACION OK",
          "pointOfSale: 7",
          "voucherType: 6",
          "voucherNumber: 2",
          "total: 1210",
          "net: 1000",
          "vat: 210",
          "authorizationPresent: true",
          "emissionType: CAE",
        ].join("\n"),
      );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("ARCA VOUCHER CONSULT")) {
        console.log(error.message);
        throw error;
      }

      fail(error);
    }
  });
});
