/**
 * El Libro de IVA elige sus comprobantes con la zona horaria del proceso:
 * `libroIvaMonthRange` hace `new Date(año, mes - 1, 1)`. ARCA, en cambio,
 * fecha el comprobante con America/Argentina/Buenos_Aires
 * (`formatArcaVoucherDate` en billing-invoice-to-cae.ts).
 *
 * Si el servidor no está en hora argentina, el mes del libro no coincide
 * con el mes calendario de ARCA: puede dejar afuera las primeras horas del
 * día 1 y tomar las primeras horas del día 1 del mes siguiente.
 *
 * Esta función no corrige ese rango. Solo dice si el mes calendario
 * argentino ya terminó, para decidir si se conserva una copia.
 */
export const LIBRO_IVA_ARCHIVE_TIME_ZONE = "America/Argentina/Buenos_Aires";

export type ArgentinaCalendarDate = {
  year: number;
  month: number;
  day: number;
};

export function argentinaCalendarDate(instant: Date): ArgentinaCalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LIBRO_IVA_ARCHIVE_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(instant);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw new Error("No se pudo leer la fecha en Argentina.");
  }

  return { year, month, day };
}

/** True cuando el mes calendario argentino ya tiene un día posterior. */
export function isArgentinaCalendarMonthClosed(
  year: number,
  month: number,
  now: Date,
): boolean {
  const today = argentinaCalendarDate(now);
  if (today.year !== year) {
    return today.year > year;
  }

  return today.month > month;
}
