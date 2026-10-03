import { describe, expect, it } from "vitest";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import { getValidArcaAccessTicket } from "@/server/arca/tickets/access-ticket";
import {
  getLastAuthorizedVoucher,
  getMaxRecordsPerRequest,
} from "@/server/arca/wsfe/wsfe-client";
import { loadNextLocalEnv } from "./load-next-env";
import { continueAfterIssuerCuit } from "./wsfe-live-issuer";

const REQUIRED_ENV = ["ARCA_HOMO_CERT_B64", "ARCA_TICKET_ENCRYPTION_KEY_B64"] as const;
const LIVE_ENABLED = process.env.ARCA_WSFE_LIVE_TEST === "1";

function missingCredentialNames(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
}

function sanitizeDiagnostic(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, "[redacted]")
    .replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[redacted]")
    .slice(0, 300);
}

async function readFiscalSettings(): Promise<{ issuerCuit: string | null } | null> {
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

function isAssertionError(error: unknown): error is Error {
  return error instanceof Error && error.name === "AssertionError";
}

function formatSafeFailure(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("WSFE HOMOLOGACION")) {
    return error.message;
  }

  if (error instanceof ArcaTicketCacheError) {
    const lines = ["WSFE HOMOLOGACION ERROR", `code: ${error.code}`];

    if (error.code === "ARCA_TICKET_ALREADY_ACTIVE_NOT_CACHED") {
      lines.push(
        "ARCA todavía tiene un Ticket vigente que este cache no tiene guardado.",
        "No se reintentó.",
      );
    }

    return lines.join("\n");
  }

  if (error instanceof ArcaConfigurationError) {
    return ["WSFE HOMOLOGACION ERROR", `code: ${error.code}`].join("\n");
  }

  if (error instanceof ArcaWsaaError) {
    const lines = ["WSFE HOMOLOGACION ERROR", `code: ${error.code}`];
    const faultCode = sanitizeDiagnostic(error.faultCode);

    if (faultCode) {
      lines.push(`faultCode: ${faultCode}`);
    }

    if (error.faultCode?.includes("coe.alreadyAuthenticated")) {
      lines.push(
        "Ya existe un Ticket de Acceso vigente para este certificado y servicio.",
        "No se reintentó el login.",
      );
    }

    return lines.join("\n");
  }

  if (error instanceof ArcaWsfeError) {
    const remoteCode = sanitizeDiagnostic(error.faultCode ?? error.remoteErrors?.[0]?.code);
    const lines = ["WSFE HOMOLOGACION ERROR", `code: ${error.code}`];

    if (remoteCode) {
      lines.push(`faultCode: ${remoteCode}`);
    }

    return lines.join("\n");
  }

  return [
    "WSFE HOMOLOGACION ERROR",
    "code: UNEXPECTED",
    "message: La prueba live falló sin un error ARCA interpretable.",
  ].join("\n");
}

describe.skipIf(!LIVE_ENABLED)("WSFE homologación live", () => {
  it("consulta FECompTotXRequest y FECompUltimoAutorizado", async () => {
    loadNextLocalEnv();

    const settings = await readFiscalSettings();

    await continueAfterIssuerCuit(settings, async (issuerCuit) => {
      const missing = missingCredentialNames();
      if (missing.length > 0) {
        throw new Error(
          `Faltan variables para la prueba live de WSFEv1: ${missing.join(", ")}. No se realizó ninguna llamada de red.`,
        );
      }

      try {
        const accessTicket = await getValidArcaAccessTicket("HOMOLOGACION");
        const maxRecords = await getMaxRecordsPerRequest({
          environment: "HOMOLOGACION",
          accessTicket,
          issuerCuit,
        });
        const lastAuthorized = await getLastAuthorizedVoucher({
          environment: "HOMOLOGACION",
          accessTicket,
          issuerCuit,
          pointOfSale: 7,
          voucherType: 6,
        });

        expect(maxRecords.maxRecords).toBeGreaterThan(0);
        expect(lastAuthorized.pointOfSale).toBe(7);
        expect(lastAuthorized.voucherType).toBe(6);

        if (lastAuthorized.lastNumber !== 1) {
          throw new Error(
            [
              "WSFE HOMOLOGACION ERROR",
              "code: LAST_AUTHORIZED_UNEXPECTED",
              `lastAuthorized: ${lastAuthorized.lastNumber}`,
              "Se esperaba 1. No se modificó ningún dato.",
            ].join("\n"),
          );
        }

        console.log(
          [
            "WSFE HOMOLOGACION OK",
            "ticketSource: CACHE",
            `maxRecords: ${maxRecords.maxRecords}`,
            "pointOfSale: 7",
            "voucherType: 6",
            "lastAuthorized: 1",
          ].join("\n"),
        );
      } catch (error) {
        if (isAssertionError(error)) {
          throw error;
        }

        const safe = formatSafeFailure(error);
        console.log(safe);
        throw new Error(safe);
      }
    });
  });
});
