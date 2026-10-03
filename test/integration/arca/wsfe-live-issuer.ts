import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";

export const FISCAL_ISSUER_CUIT_NOT_CONFIGURED =
  "BillingFiscalSettings.issuerCuit no está configurado correctamente.";

export function resolveLiveIssuerCuit(
  settings: { issuerCuit: string | null | undefined } | null | undefined,
): string {
  if (!settings) {
    throw new Error(FISCAL_ISSUER_CUIT_NOT_CONFIGURED);
  }

  try {
    return normalizeIssuerCuit(settings.issuerCuit);
  } catch {
    throw new Error(FISCAL_ISSUER_CUIT_NOT_CONFIGURED);
  }
}

/** Valida el CUIT fiscal y solo entonces continúa. No llama a ARCA. */
export async function continueAfterIssuerCuit<T>(
  settings: { issuerCuit: string | null | undefined } | null | undefined,
  next: (issuerCuit: string) => Promise<T>,
): Promise<T> {
  const issuerCuit = resolveLiveIssuerCuit(settings);
  return next(issuerCuit);
}
