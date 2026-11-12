import { describe, expect, it } from "vitest";
import { libroIvaMonthRange } from "@/features/billing/utils/libro-iva";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import {
  isIssuedInRange,
  listMonths,
  statisticsCustomRange,
  statisticsMonthRange,
  statisticsYearRange,
} from "@/server/services/billing-statistics/periods";
import { parseStatisticsQuery } from "@/server/services/billing-statistics/query";

describe("períodos de estadísticas", () => {
  it("reutiliza el rango mensual del Libro de IVA", () => {
    expect(statisticsMonthRange(2026, 3)).toEqual(libroIvaMonthRange(2026, 3));
  });

  it("arma el año con enero inclusive y enero siguiente exclusivo", () => {
    const range = statisticsYearRange(2026);

    expect(range.from).toEqual(libroIvaMonthRange(2026, 1).from);
    expect(range.to).toEqual(libroIvaMonthRange(2026, 12).to);
    expect(listMonths(range)).toHaveLength(12);
    expect(isIssuedInRange(new Date(2026, 0, 1), range)).toBe(true);
    expect(isIssuedInRange(new Date(2026, 11, 31, 23, 59, 59), range)).toBe(true);
    expect(isIssuedInRange(new Date(2027, 0, 1), range)).toBe(false);
  });

  it("incluye el día inicial y excluye el instante final", () => {
    const range = statisticsMonthRange(2026, 3);

    expect(isIssuedInRange(new Date(2026, 2, 1), range)).toBe(true);
    expect(isIssuedInRange(new Date(2026, 2, 31, 23, 59, 59), range)).toBe(true);
    expect(isIssuedInRange(new Date(2026, 3, 1), range)).toBe(false);
  });

  it("cruza de año en un rango personalizado y rechaza fechas imposibles", () => {
    const range = statisticsCustomRange("2026-12-15", "2027-01-10");
    const months = listMonths(range);

    expect(months.map((month) => month.key)).toEqual(["2026-12", "2027-01"]);
    expect(isIssuedInRange(new Date(2026, 11, 14, 23, 59, 59), range)).toBe(false);
    expect(isIssuedInRange(new Date(2026, 11, 15), range)).toBe(true);
    expect(isIssuedInRange(new Date(2027, 0, 10, 23, 59, 59), range)).toBe(true);
    expect(isIssuedInRange(new Date(2027, 0, 11), range)).toBe(false);
    expect(statisticsCustomRange("2024-02-29", "2024-02-29").from).toEqual(
      new Date(2024, 1, 29),
    );
    expect(() => statisticsCustomRange("2026-02-29", "2026-03-01")).toThrow(
      "Indicá un rango de fechas válido.",
    );
    expect(() => statisticsCustomRange("2026-03-10", "2026-03-01")).toThrow(
      "La fecha desde no puede ser posterior a la fecha hasta.",
    );
  });
});

describe("consulta de estadísticas", () => {
  it("acepta mes, año y comparación", () => {
    const month = parseStatisticsQuery(
      new URLSearchParams("period=month&year=2026&month=03"),
      "summary",
    );
    const year = parseStatisticsQuery(
      new URLSearchParams(
        "period=year&year=2026&comparePeriod=month&compareYear=2026&compareMonth=3",
      ),
      "summary",
    );

    expect(month.period.range).toEqual(statisticsMonthRange(2026, 3));
    expect(year.comparison?.range).toEqual(statisticsMonthRange(2026, 3));
    expect(year.period.range.from).toEqual(new Date(2026, 0, 1));
  });

  it("rechaza ambiente, parámetros ajenos al recurso y fechas inválidas", () => {
    expect(() =>
      parseStatisticsQuery(
        new URLSearchParams("period=month&year=2026&month=3&environment=PRODUCCION"),
        "summary",
      ),
    ).toThrow(BillingInvoiceError);
    expect(() =>
      parseStatisticsQuery(
        new URLSearchParams("period=month&year=2026&month=3&clientKey=client:abc"),
        "summary",
      ),
    ).toThrow("Este recurso no admite clientKey.");
    expect(() =>
      parseStatisticsQuery(
        new URLSearchParams("period=custom&from=2026-03-10&to=2026-03-01"),
        "clients",
      ),
    ).toThrow("La fecha desde no puede ser posterior a la fecha hasta.");
    expect(() =>
      parseStatisticsQuery(
        new URLSearchParams("period=month&year=2026&month=13"),
        "rubros",
      ),
    ).toThrow(BillingInvoiceError);
    expect(() =>
      parseStatisticsQuery(
        new URLSearchParams("period=month&year=2026&month=3&limit=0"),
        "clients",
      ),
    ).toThrow(BillingInvoiceError);
    expect(() =>
      parseStatisticsQuery(
        new URLSearchParams("period=year&year=2026&compareYear=2025"),
        "summary",
      ),
    ).toThrow("La comparación necesita comparePeriod.");
    expect(() =>
      parseStatisticsQuery(
        new URLSearchParams("period=month&year=2026&month=3&clientKey=cliente"),
        "clients",
      ),
    ).toThrow("La clave de cliente no es válida.");
    expect(
      parseStatisticsQuery(
        new URLSearchParams("period=month&year=2026&month=3&rubroKey=adjustments"),
        "rubros",
      ).rubroKey,
    ).toBe("adjustments");
  });
});
