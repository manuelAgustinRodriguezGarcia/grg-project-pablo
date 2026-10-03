import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";

/**
 * Normaliza BillingFiscalSettings.issuerCuit a 11 dígitos.
 * No persiste cambios ni lee variables de entorno.
 */
export function normalizeIssuerCuit(
  issuerCuit: string | null | undefined,
): string {
  if (!issuerCuit?.trim()) {
    throw new ArcaConfigurationError(
      "El CUIT del emisor no está configurado.",
      "CUIT_INVALIDO",
    );
  }

  const digits = issuerCuit.replace(/\D/g, "");

  if (!/^\d{11}$/.test(digits)) {
    throw new ArcaConfigurationError(
      "El CUIT del emisor debe tener 11 dígitos.",
      "CUIT_INVALIDO",
    );
  }

  return digits;
}
