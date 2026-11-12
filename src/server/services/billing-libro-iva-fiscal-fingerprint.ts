import { createHash } from "node:crypto";
import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import type { LibroIvaRow } from "@/features/billing/utils/libro-iva";

/**
 * Versión de la huella. Cambiarla haría parecer modificados todos los
 * libros ya archivados, aunque los comprobantes sigan igual.
 *
 * La huella cubre las filas que ya armó el generador (tipo, letra, punto
 * de venta, número, fecha, cliente, condición, alícuota, neto, IVA, total
 * y comprobante asociado) más el ambiente. No vuelve a calcular importes.
 *
 * No detecta cambios de membrete, columnas, anchos, textos fijos ni del
 * porcentaje de IVA de configuración que el resumen imprime aparte de
 * cada comprobante. Para eso está la huella del archivo.
 */
export const LIBRO_IVA_FISCAL_FINGERPRINT_VERSION = 1;

function rowLine(row: LibroIvaRow): string {
  return JSON.stringify([
    row.issuedAt.toISOString(),
    row.docKind,
    row.letter,
    row.pointOfSale,
    row.number,
    row.associatedNumber,
    row.clientName,
    row.identification,
    row.ivaCondition,
    row.ivaPercent,
    row.netAmount,
    row.ivaAmount,
    row.total,
  ]);
}

export function fiscalDataSha256(
  environment: BillingFiscalEnvironment,
  rows: readonly LibroIvaRow[],
): string {
  const lines = rows.map(rowLine).sort((left, right) => {
    if (left < right) {
      return -1;
    }
    if (left > right) {
      return 1;
    }
    return 0;
  });
  const payload = JSON.stringify({
    v: LIBRO_IVA_FISCAL_FINGERPRINT_VERSION,
    environment,
    rows: lines,
  });

  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function fileSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
