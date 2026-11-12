import { Buffer } from "node:buffer";

const FIELD_SEPARATOR = "\u001f";

export type ClientIdentityInput = {
  clientId: string | null;
  clientCode: string;
  clientName: string;
  clientIdentificationType: string;
  clientIdentificationNumber: string | null;
};

export type RubroIdentityInput = {
  rubroId: string | null;
  rubroCode: string;
  rubroName: string;
};

/**
 * Un clientId agrupa todos los comprobantes de ese cliente, aunque el
 * nombre impreso haya cambiado. No se lee el nombre actual de la ficha.
 *
 * Si el cliente fue eliminado, clientId queda nulo. En ese caso la clave
 * usa código, tipo y número de identificación y nombre tal como quedaron
 * en el comprobante. No se vuelve a unir con un cliente vivo que reutilice
 * el código: ese reúso no se puede distinguir con seguridad.
 * Dos comprobantes del mismo cliente eliminado quedan separados si alguno
 * de esos datos históricos difiere.
 */
export function clientGroupKey(input: ClientIdentityInput): string {
  if (input.clientId) {
    return `client:${input.clientId}`;
  }

  return `historical:${encodeHistoricalToken([
    input.clientCode,
    input.clientIdentificationType,
    input.clientIdentificationNumber ?? "",
    input.clientName,
  ])}`;
}

/**
 * Un rubroId agrupa las líneas aunque el rubro se haya renombrado.
 * La etiqueta visible sale del snapshot más reciente del período, no del
 * nombre actual de la ficha.
 *
 * Si el rubro fue eliminado, rubroId queda nulo. La clave usa código y
 * nombre históricos y no se mezcla con un rubro vivo del mismo código.
 * Un renombre posterior al borrado separa los grupos.
 */
export function rubroGroupKey(input: RubroIdentityInput): string {
  if (input.rubroId) {
    return `rubro:${input.rubroId}`;
  }

  return `historical:${encodeHistoricalToken([input.rubroCode, input.rubroName])}`;
}

export function encodeHistoricalToken(parts: readonly string[]): string {
  return Buffer.from(parts.join(FIELD_SEPARATOR), "utf8").toString("base64url");
}
