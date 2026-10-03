import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";

const POINT_OF_SALE_PATTERN = /^\d{1,5}$/;

/**
 * Convierte el punto de venta guardado como texto ("0007")
 * al entero que pide WSFEv1 (7).
 */
export function parseArcaPointOfSale(pointOfSale: string): number {
  const normalized = pointOfSale.trim();

  if (!POINT_OF_SALE_PATTERN.test(normalized)) {
    throw new ArcaConfigurationError(
      "El punto de venta no es válido para ARCA.",
      "PUNTO_DE_VENTA_INVALIDO",
    );
  }

  const value = Number(normalized);

  if (!Number.isInteger(value) || value < 1 || value > 99999) {
    throw new ArcaConfigurationError(
      "El punto de venta no es válido para ARCA.",
      "PUNTO_DE_VENTA_INVALIDO",
    );
  }

  return value;
}
