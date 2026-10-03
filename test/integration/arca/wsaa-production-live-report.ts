import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";

function sanitizeDiagnostic(value: string): string {
  return value
    .replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, "[redacted]")
    .replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function knownFaultMessage(value: string): string | null {
  const text = value.toLowerCase();

  if (text.includes("certificado no autorizado")) {
    return "Certificado no autorizado.";
  }

  if (text.includes("computador no autorizado")) {
    return "Computador no autorizado.";
  }

  if (
    text.includes("servicio no autorizado") ||
    text.includes("no autorizado a acceder al servicio") ||
    text.includes("no se encuentra autorizado")
  ) {
    return "Servicio no autorizado.";
  }

  if (
    text.includes("certificado inválido") ||
    text.includes("certificado invalido")
  ) {
    return "Certificado inválido.";
  }

  return null;
}

/** Informe seguro del live test. No incluye token, sign, PEM, CMS ni SOAP. */
export function formatProductionWsaaLiveFailure(error: unknown): string {
  if (error instanceof ArcaWsaaError) {
    const raw = `${error.faultCode ?? ""} ${error.faultString ?? ""} ${error.message}`;
    const message =
      knownFaultMessage(raw) ??
      sanitizeDiagnostic(error.faultString ?? error.message);
    const lines = ["ARCA WSAA PRODUCCION ERROR", `code: ${error.code}`];

    if (error.faultCode) {
      lines.push(`faultCode: ${sanitizeDiagnostic(error.faultCode)}`);
    }

    lines.push(`message: ${message}`);
    return lines.join("\n");
  }

  if (
    error instanceof ArcaConfigurationError ||
    error instanceof ArcaTicketCacheError
  ) {
    return [
      "ARCA WSAA PRODUCCION ERROR",
      `code: ${error.code}`,
      `message: ${sanitizeDiagnostic(error.message)}`,
    ].join("\n");
  }

  return [
    "ARCA WSAA PRODUCCION ERROR",
    "code: UNEXPECTED",
    "message: La prueba live falló sin un error WSAA interpretable.",
  ].join("\n");
}

export function formatProductionWsaaLiveSuccess(ticket: {
  environment: string;
  service: string;
  expirationTime: Date;
}): string {
  return [
    "ARCA WSAA PRODUCCION OK",
    `environment: ${ticket.environment}`,
    `service: ${ticket.service}`,
    "tokenPresent: true",
    "signPresent: true",
    `expiresAt: ${ticket.expirationTime.toISOString()}`,
  ].join("\n");
}
