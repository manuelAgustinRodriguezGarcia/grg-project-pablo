export type ArcaConfigurationErrorCode =
  | "CERTIFICADO_AUSENTE"
  | "CERTIFICADO_INVALIDO"
  | "PRIVATE_KEY_AUSENTE"
  | "PRIVATE_KEY_INVALIDA"
  | "CUIT_INVALIDO"
  | "AMBIENTE_NO_SOPORTADO"
  | "PUNTO_DE_VENTA_INVALIDO"
  | "CLAVE_CIFRADO_AUSENTE"
  | "CLAVE_CIFRADO_INVALIDA";

export class ArcaConfigurationError extends Error {
  readonly code: ArcaConfigurationErrorCode;

  constructor(message: string, code: ArcaConfigurationErrorCode) {
    super(message);
    this.name = "ArcaConfigurationError";
    this.code = code;
  }
}
