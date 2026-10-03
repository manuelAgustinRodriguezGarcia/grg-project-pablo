export const ARCA_PRODUCTION_EMISSION_ENABLED_ENV =
  "ARCA_PRODUCTION_EMISSION_ENABLED";

export const PRODUCTION_EMISSION_DISABLED_MESSAGE =
  "La emisión en producción no está habilitada.";

export const PRODUCTION_CONFIGURATION_INCOMPLETE_MESSAGE =
  "Falta completar la configuración fiscal del emisor.";

export const PRODUCTION_CREDENTIALS_UNAVAILABLE_MESSAGE =
  "Las credenciales de ARCA para producción no están disponibles.";

/** Solo el texto exacto "true" habilita la emisión productiva. */
export function isProductionEmissionEnabledValue(
  value: string | undefined,
): boolean {
  return value === "true";
}
