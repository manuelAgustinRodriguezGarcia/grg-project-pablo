import { describe, it } from "vitest";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import { getValidArcaAccessTicket } from "@/server/arca/tickets/access-ticket";
import { getLastAuthorizedVoucher, requestCae } from "@/server/arca/wsfe/wsfe-client";
import {
  formatCaeLiveReport,
  resolveLiveFiscalContext,
  runHomologationCaeLive,
} from "./cae-live-flow";
import { loadNextLocalEnv } from "./load-next-env";

const REQUIRED_ENV = ["ARCA_HOMO_CERT_B64", "ARCA_TICKET_ENCRYPTION_KEY_B64"] as const;
const LIVE_ENABLED = process.env.ARCA_CAE_LIVE_TEST === "1";

function missingCredentialNames(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
}

async function readFiscalSettings(): Promise<{
  issuerCuit: string | null;
  pointOfSale: string;
} | null> {
  const { BILLING_FISCAL_SETTINGS_ID } = await import(
    "@/server/repositories/billing-fiscal-settings.repository"
  );
  const { prisma } = await import("@/server/database/prisma");

  try {
    return await prisma.billingFiscalSettings.findUnique({
      where: { id: BILLING_FISCAL_SETTINGS_ID },
      select: { issuerCuit: true, pointOfSale: true },
    });
  } catch {
    throw new Error(
      "No se pudo leer BillingFiscalSettings. No se realizó ninguna llamada de red.",
    );
  }
}

function formatThrown(error: unknown): string {
  if (error instanceof ArcaWsfeError || error instanceof ArcaConfigurationError) {
    return ["ARCA CAE HOMOLOGACION ERROR", `code: ${error.code}`, "No se reintentó."].join(
      "\n",
    );
  }

  if (error instanceof ArcaTicketCacheError) {
    const lines = ["ARCA CAE HOMOLOGACION ERROR", `code: ${error.code}`, "No se reintentó."];

    if (error.code === "ARCA_TICKET_ALREADY_ACTIVE_NOT_CACHED") {
      lines.push("ARCA todavía tiene un Ticket vigente que este cache no tiene guardado.");
    }

    return lines.join("\n");
  }

  if (error instanceof ArcaWsaaError) {
    return ["ARCA CAE HOMOLOGACION ERROR", `code: ${error.code}`, "No se reintentó."].join(
      "\n",
    );
  }

  if (error instanceof Error && error.message.startsWith("ARCA")) {
    return error.message;
  }

  if (error instanceof Error && error.message.startsWith("CAE fue aprobado")) {
    return error.message;
  }

  if (error instanceof Error && error.message.startsWith("No se pudo leer BillingFiscalSettings")) {
    return error.message;
  }

  if (error instanceof Error && error.message.startsWith("Faltan variables")) {
    return error.message;
  }

  return [
    "ARCA CAE HOMOLOGACION ERROR",
    "code: UNEXPECTED",
    "No se reintentó.",
  ].join("\n");
}

function fail(error: unknown): never {
  const safe = formatThrown(error);
  console.log(safe);
  throw new Error(safe);
}

function alreadyReported(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error.message.startsWith("ARCA CAE HOMOLOGACION") ||
      error.message.startsWith("ARCA_CAE_LIVE_PRECONDITION_FAILED") ||
      error.message.startsWith("CAE fue aprobado"))
  );
}

describe.skipIf(!LIVE_ENABLED)("CAE homologación live", () => {
  it("emite una sola Factura B número 2 si el último autorizado es 1", async () => {
    loadNextLocalEnv();

    let fiscal: { issuerCuit: string; pointOfSale: number } | undefined;

    try {
      fiscal = resolveLiveFiscalContext(await readFiscalSettings());
    } catch (error) {
      fail(error);
    }

    if (!fiscal) {
      fail(new Error("ARCA_CAE_LIVE_PRECONDITION_FAILED\nNo se emitió ningún comprobante."));
    }

    const missing = missingCredentialNames();

    if (missing.length > 0) {
      fail(
        new Error(
          `Faltan variables para la prueba live de CAE: ${missing.join(", ")}. No se realizó ninguna llamada de red.`,
        ),
      );
    }

    try {
      const accessTicket = await getValidArcaAccessTicket("HOMOLOGACION");
      const outcome = await runHomologationCaeLive({
        issuerCuit: fiscal.issuerCuit,
        accessTicket,
        now: new Date(),
        dependencies: {
          getLastAuthorizedVoucher,
          requestCae,
        },
      });
      const report = formatCaeLiveReport(outcome);
      console.log(report);

      if (outcome.kind !== "approved") {
        throw new Error(report);
      }
    } catch (error) {
      if (alreadyReported(error)) {
        throw error;
      }

      fail(error);
    }
  });
});
