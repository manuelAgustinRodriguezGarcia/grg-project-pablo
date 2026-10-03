import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import type { ProductionWsfeReadOnlyResult } from "./wsfe-production-live-flow";

function sanitizeDiagnostic(value: string): string {
  return value
    .replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, "[redacted]")
    .replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function safeOwnMessage(error: Error): string | null {
  if (
    error.message.startsWith("ARCA WSFE PRODUCCION ERROR") ||
    error.message.startsWith("BillingFiscalSettings.") ||
    error.message.startsWith("No se pudo leer BillingFiscalSettings.") ||
    error.message.startsWith("Faltan variables para la prueba live")
  ) {
    return sanitizeDiagnostic(error.message);
  }

  return null;
}

/** Informe seguro. No incluye token, sign, PEM, SOAP ni CAE. */
export function formatProductionWsfeReadOnlyFailure(error: unknown): string {
  if (error instanceof ArcaWsfeError) {
    const lines = ["ARCA WSFE PRODUCCION ERROR", `code: ${error.code}`];
    const remoteCode = error.faultCode ?? error.remoteErrors?.[0]?.code;

    if (remoteCode) {
      lines.push(`faultCode: ${sanitizeDiagnostic(remoteCode)}`);
    }

    lines.push(`message: ${sanitizeDiagnostic(error.message)}`);
    return lines.join("\n");
  }

  if (error instanceof ArcaWsaaError) {
    const lines = ["ARCA WSFE PRODUCCION ERROR", `code: ${error.code}`];

    if (error.faultCode) {
      lines.push(`faultCode: ${sanitizeDiagnostic(error.faultCode)}`);
    }

    lines.push(`message: ${sanitizeDiagnostic(error.message)}`);
    return lines.join("\n");
  }

  if (
    error instanceof ArcaConfigurationError ||
    error instanceof ArcaTicketCacheError
  ) {
    return [
      "ARCA WSFE PRODUCCION ERROR",
      `code: ${error.code}`,
      `message: ${sanitizeDiagnostic(error.message)}`,
    ].join("\n");
  }

  if (error instanceof Error) {
    const ownMessage = safeOwnMessage(error);

    if (ownMessage) {
      return ownMessage;
    }
  }

  return [
    "ARCA WSFE PRODUCCION ERROR",
    "code: UNEXPECTED",
    "message: La prueba live falló sin un error ARCA interpretable.",
  ].join("\n");
}

export function formatProductionWsfeReadOnlySuccess(
  result: ProductionWsfeReadOnlyResult,
): string {
  return [
    "ARCA WSFE PRODUCCION READ ONLY OK",
    `pointOfSale: ${result.pointOfSale}`,
    `maxRecordsPerRequest: ${result.maxRecordsPerRequest}`,
    `lastFacturaA: ${result.lastFacturaA}`,
    `lastFacturaB: ${result.lastFacturaB}`,
  ].join("\n");
}
