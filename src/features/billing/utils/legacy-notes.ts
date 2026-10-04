import type { BillingFiscalEnvironment } from "@/generated/prisma/client";

export const LEGACY_NOTES_DISABLED_MESSAGE =
  "Las Notas de Crédito y Débito fiscales todavía no están habilitadas en este ambiente.";

export const LEGACY_NOTE_INVOICE_ENVIRONMENT_MESSAGE =
  "Las notas internas de prueba solo pueden aplicarse a facturas emitidas en MODO_PRUEBA.";

export function legacyInternalNotesAllowed(
  environment: BillingFiscalEnvironment,
): boolean {
  switch (environment) {
    case "MODO_PRUEBA":
      return true;
    case "HOMOLOGACION":
    case "PRODUCCION":
      return false;
    default: {
      const unexpected: never = environment;
      return unexpected;
    }
  }
}
