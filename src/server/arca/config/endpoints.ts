import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import type {
  ArcaEndpoints,
  ArcaEnvironment,
} from "@/server/arca/types/arca.types";

const ARCA_SERVICE = "wsfe" as const;

const HOMOLOGACION_ENDPOINTS = {
  wsaaUrl: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
  wsfeUrl: "https://wswhomo.afip.gob.ar/wsfev1/service.asmx",
  service: ARCA_SERVICE,
} as const satisfies ArcaEndpoints;

const PRODUCCION_ENDPOINTS = {
  wsaaUrl: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
  wsfeUrl: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
  service: ARCA_SERVICE,
} as const satisfies ArcaEndpoints;

/**
 * Resuelve URLs de WSAA/WSFEv1. No abre conexiones.
 * MODO_PRUEBA es el modo interno del sistema y no tiene endpoints ARCA.
 */
export function resolveArcaEndpoints(
  environment: ArcaEnvironment | "MODO_PRUEBA",
): ArcaEndpoints {
  switch (environment) {
    case "MODO_PRUEBA":
      throw new ArcaConfigurationError(
        "El modo prueba interno no se conecta con ARCA.",
        "AMBIENTE_NO_SOPORTADO",
      );
    case "HOMOLOGACION":
      return HOMOLOGACION_ENDPOINTS;
    case "PRODUCCION":
      return PRODUCCION_ENDPOINTS;
    default: {
      const exhaustive: never = environment;
      return exhaustive;
    }
  }
}
