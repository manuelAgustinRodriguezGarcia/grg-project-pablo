import { describe, expect, it } from "vitest";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import { requestWsaaTicket } from "@/server/arca/wsaa/wsaa-client";
import { loadNextLocalEnv } from "./load-next-env";

const REQUIRED_ENV = ["ARCA_HOMO_CERT_B64", "ARCA_HOMO_PRIVATE_KEY_B64"] as const;

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

function isAssertionError(error: unknown): error is Error {
  return error instanceof Error && error.name === "AssertionError";
}

function formatSafeFailure(error: unknown): string {
  if (error instanceof ArcaWsaaError) {
    const lines = [
      "WSAA HOMOLOGACION ERROR",
      `code: ${error.code}`,
      `faultCode: ${error.faultCode ?? ""}`,
      `message: ${sanitizeDiagnostic(error.faultString ?? error.message)}`,
    ];

    if (error.faultCode?.includes("coe.alreadyAuthenticated")) {
      lines.push(
        "Ya existe un Ticket de Acceso vigente para este certificado y servicio.",
        "No se reintentó el login.",
      );
    }

    return lines.join("\n");
  }

  return [
    "WSAA HOMOLOGACION ERROR",
    "code: UNEXPECTED",
    "message: La prueba live falló sin un error WSAA interpretable.",
  ].join("\n");
}

describe("WSAA homologación live", () => {
  it("pide un único Ticket de Acceso real", async () => {
    if (process.env.ARCA_LIVE_TEST !== "1") {
      throw new Error(
        "La prueba live de WSAA está desactivada. Definí ARCA_LIVE_TEST=1 para ejecutarla. No se realizó ninguna llamada de red.",
      );
    }

    loadNextLocalEnv();

    const missing = missingCredentialNames();
    if (missing.length > 0) {
      throw new Error(
        `Faltan variables para la prueba live de WSAA: ${missing.join(", ")}. No se realizó ninguna llamada de red.`,
      );
    }

    try {
      const ticket = await requestWsaaTicket("HOMOLOGACION");
      const now = new Date();

      expect(ticket.token.trim().length).toBeGreaterThan(0);
      expect(ticket.sign.trim().length).toBeGreaterThan(0);
      expect(Number.isNaN(ticket.generationTime.getTime())).toBe(false);
      expect(Number.isNaN(ticket.expirationTime.getTime())).toBe(false);
      expect(ticket.expirationTime.getTime()).toBeGreaterThan(now.getTime());
      expect(ticket.environment).toBe("HOMOLOGACION");
      expect(ticket.service).toBe("wsfe");

      console.log(
        [
          "WSAA HOMOLOGACION OK",
          `service: ${ticket.service}`,
          `environment: ${ticket.environment}`,
          "tokenPresent: true",
          "signPresent: true",
          `generationTime: ${ticket.generationTime.toISOString()}`,
          `expirationTime: ${ticket.expirationTime.toISOString()}`,
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
