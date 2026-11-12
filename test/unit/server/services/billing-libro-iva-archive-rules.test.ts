import { describe, expect, it } from "vitest";
import type { LibroIvaRow } from "@/features/billing/utils/libro-iva";
import {
  argentinaCalendarDate,
  isArgentinaCalendarMonthClosed,
} from "@/server/services/billing-libro-iva-archive-eligibility";
import { fiscalDataSha256 } from "@/server/services/billing-libro-iva-fiscal-fingerprint";

function row(overrides: Partial<LibroIvaRow> = {}): LibroIvaRow {
  return {
    issuedAt: new Date("2026-10-02T15:00:00.000Z"),
    docKind: "FACTURA",
    letter: "A",
    pointOfSale: "0007",
    number: "0007-00000001",
    clientName: "Cliente",
    identification: "30-71234567-1",
    ivaCondition: "RI",
    ivaPercent: 21,
    netAmount: 1000,
    ivaAmount: 210,
    total: 1210,
    associatedNumber: "",
    ...overrides,
  };
}

describe("cierre de mes en Argentina", () => {
  it("octubre sigue abierto a las 23:59 del 31 en Buenos Aires", () => {
    const now = new Date("2026-11-01T02:59:59.999Z");

    expect(argentinaCalendarDate(now)).toEqual({
      year: 2026,
      month: 10,
      day: 31,
    });
    expect(isArgentinaCalendarMonthClosed(2026, 10, now)).toBe(false);
    expect(isArgentinaCalendarMonthClosed(2026, 11, now)).toBe(false);
  });

  it("octubre cierra a las 00:00 del 1 de noviembre en Buenos Aires", () => {
    const now = new Date("2026-11-01T03:00:00.000Z");

    expect(argentinaCalendarDate(now)).toEqual({
      year: 2026,
      month: 11,
      day: 1,
    });
    expect(isArgentinaCalendarMonthClosed(2026, 10, now)).toBe(true);
    expect(isArgentinaCalendarMonthClosed(2026, 11, now)).toBe(false);
  });

  it("diciembre sigue abierto hasta las 23:59 del 31 en Buenos Aires", () => {
    const now = new Date("2027-01-01T02:59:59.999Z");

    expect(argentinaCalendarDate(now)).toEqual({
      year: 2026,
      month: 12,
      day: 31,
    });
    expect(isArgentinaCalendarMonthClosed(2026, 12, now)).toBe(false);
    expect(isArgentinaCalendarMonthClosed(2025, 12, now)).toBe(true);
  });

  it("diciembre cierra a las 00:00 del 1 de enero en Buenos Aires", () => {
    const now = new Date("2027-01-01T03:00:00.000Z");

    expect(argentinaCalendarDate(now)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(isArgentinaCalendarMonthClosed(2026, 12, now)).toBe(true);
    expect(isArgentinaCalendarMonthClosed(2027, 1, now)).toBe(false);
  });
});

describe("huella fiscal del libro", () => {
  it("no depende del orden y cambia con un importe o el ambiente", () => {
    const credit = row({
      docKind: "NC",
      number: "0007-00000004",
      netAmount: -100,
      ivaAmount: -21,
      total: -121,
      associatedNumber: "0007-00000001",
    });
    const invoice = row();
    const forward = fiscalDataSha256("PRODUCCION", [invoice, credit]);
    const reversed = fiscalDataSha256("PRODUCCION", [credit, invoice]);

    expect(reversed).toBe(forward);
    expect(fiscalDataSha256("HOMOLOGACION", [invoice, credit])).not.toBe(forward);
    expect(fiscalDataSha256("MODO_PRUEBA", [invoice, credit])).not.toBe(forward);
    expect(
      fiscalDataSha256("PRODUCCION", [{ ...invoice, total: 1210.01 }, credit]),
    ).not.toBe(forward);
    expect(fiscalDataSha256("PRODUCCION", [invoice, credit])).toBe(forward);
  });
});
