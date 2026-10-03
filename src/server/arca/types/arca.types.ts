export type ArcaEnvironment = "HOMOLOGACION" | "PRODUCCION";

export type ArcaEndpoints = {
  wsaaUrl: string;
  wsfeUrl: string;
  service: "wsfe";
};

/** PEM ya decodificado. No loguear ni enviar al cliente. */
export type ArcaCredentials = {
  certificatePem: string;
  privateKeyPem: string;
};

export type ArcaIssuerContext = {
  environment: ArcaEnvironment;
  /** CUIT representado, solo dígitos (11). */
  cuit: string;
  /** Punto de venta numérico que espera WSFEv1 (0007 → 7). */
  pointOfSale: number;
};
