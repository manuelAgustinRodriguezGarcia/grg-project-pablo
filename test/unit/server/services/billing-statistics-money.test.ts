import { describe, expect, it } from "vitest";
import {
  distributeByWeights,
  formatMinorUnits,
  moneyFromInvoice,
  moneyFromNote,
  parseMinorUnits,
  roundingGapCents,
  shareOf,
} from "@/server/services/billing-statistics/money";

describe("estadísticas monetarias", () => {
  it("convierte centavos sin usar un float como acumulador", () => {
    expect(parseMinorUnits("165.00")).toBe(BigInt(16500));
    expect(parseMinorUnits("-0.40")).toBe(BigInt(-40));
    expect(formatMinorUnits(BigInt(-40))).toBe("-0.40");
    expect(formatMinorUnits(BigInt(0))).toBe("0.00");
    expect(() => parseMinorUnits("1.5")).toThrow();
    expect(() => parseMinorUnits("1.555")).toThrow();
  });

  it("conserva la diferencia entre el total visual y el neto más el IVA", () => {
    const money = moneyFromInvoice({
      total: "121.40",
      ivaAmount: "21.07",
      totalVisualRounded: "121.00",
    });

    expect(money.netCents).toBe(BigInt(10033));
    expect(money.vatCents).toBe(BigInt(2107));
    expect(money.totalCents).toBe(BigInt(12100));
    expect(roundingGapCents(money)).toBe(BigInt(-40));
  });

  it("aplica el signo de la nota una sola vez", () => {
    const credit = moneyFromNote({
      kind: "CREDIT",
      netAmount: "41.32",
      ivaAmount: "8.68",
      amount: "50.00",
    });
    const debit = moneyFromNote({
      kind: "DEBIT",
      netAmount: "10.00",
      ivaAmount: "2.10",
      amount: "12.10",
    });

    expect(credit.totalCents).toBe(BigInt(-5000));
    expect(credit.netCents).toBe(BigInt(-4132));
    expect(debit.totalCents).toBe(BigInt(1210));
    expect(debit.vatCents).toBe(BigInt(210));
  });

  it("reparte 165.00 entre 100.00, 50.00 y 33.33 sin perder centavos", () => {
    const shares = distributeByWeights(BigInt(16500), [
      BigInt(10000),
      BigInt(5000),
      BigInt(3333),
    ]);

    expect(shares).toEqual([BigInt(9000), BigInt(4500), BigInt(3000)]);
    expect(shares.reduce((sum, share) => sum + share, BigInt(0))).toBe(BigInt(16500));
  });

  it("asigna el resto al primer índice cuando los restos empatan", () => {
    expect(distributeByWeights(BigInt(100), [BigInt(1), BigInt(1), BigInt(1)])).toEqual([
      BigInt(34),
      BigInt(33),
      BigInt(33),
    ]);
  });

  it("reparte en partes iguales si todos los pesos son cero", () => {
    expect(distributeByWeights(BigInt(100), [BigInt(0), BigInt(0), BigInt(0)])).toEqual([
      BigInt(34),
      BigInt(33),
      BigInt(33),
    ]);
  });

  it("conserva el signo y la suma cuando el total es negativo", () => {
    const shares = distributeByWeights(BigInt(-100), [BigInt(1), BigInt(1), BigInt(1)]);

    expect(shares).toEqual([BigInt(-34), BigInt(-33), BigInt(-33)]);
    expect(shares.reduce((sum, share) => sum + share, BigInt(0))).toBe(BigInt(-100));
  });

  it("rechaza pesos negativos", () => {
    expect(() => distributeByWeights(BigInt(100), [BigInt(10), BigInt(-1)])).toThrow();
  });

  it("no publica un porcentaje si el total del período no es positivo", () => {
    expect(shareOf(BigInt(100), BigInt(0))).toEqual({
      percent: null,
      unavailableReason: "ZERO_TOTAL",
    });
    expect(shareOf(BigInt(100), BigInt(-50))).toEqual({
      percent: null,
      unavailableReason: "NEGATIVE_TOTAL",
    });
    expect(shareOf(BigInt(-5000), BigInt(19000)).percent).toBe("-26.32");
    expect(shareOf(BigInt(10000), BigInt(19000)).percent).toBe("52.63");
  });
});
