import "server-only";

/** Margen interno. No es la vigencia del TRA ni el vencimiento crudo de ARCA. */
export const ARCA_TICKET_REUSE_MARGIN_MS = 5 * 60 * 1000;

export function isArcaTicketReusable(
  expirationTime: Date,
  now: Date,
  marginMs: number = ARCA_TICKET_REUSE_MARGIN_MS,
): boolean {
  return expirationTime.getTime() > now.getTime() + marginMs;
}
