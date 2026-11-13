import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatArs, formatArsExact } from "@/features/billing/utils/format-ars";
import {
  buildParticipationChart,
  centsToAmountString,
  formatStatisticsAmount,
  statisticsGrowthLabel,
} from "@/features/billing/utils/billing-statistics-display";
import {
  periodQueryError,
  previousPeriod,
  selectCustom,
  selectFullYear,
  selectMonth,
  selectYear,
  statisticsInvoicedYearOptions,
  statisticsRequestSearch,
  statisticsScopeKey,
  statisticsSelectableYear,
} from "@/features/billing/utils/billing-statistics-period";

const november = { mode: "month" as const, year: 2026, month: 11 };

describe("selector de estadísticas", () => {
  it("ofrece solo años con facturación desde 2026", () => {
    expect(statisticsInvoicedYearOptions([2023, 2024, 2025, 2026, 2026, 2027])).toEqual([
      2027,
      2026,
    ]);
    expect(statisticsInvoicedYearOptions([2025, 2024, 999])).toEqual([]);
    expect(statisticsSelectableYear(2027, [2026])).toBe(2026);
    expect(statisticsSelectableYear(2026, [2026, 2027])).toBe(2026);
    expect(statisticsSelectableYear(2026, [])).toBe(2026);
  });

  it("cambia de mes sin perder el año", () => {
    expect(selectMonth(november, 2, 2026)).toEqual({
      mode: "month",
      year: 2026,
      month: 2,
    });
  });

  it("arma el año completo y cambia de año conservando el mes", () => {
    expect(selectFullYear(november, 2026)).toEqual({ mode: "year", year: 2026 });
    expect(selectYear(november, 2025)).toEqual({
      mode: "month",
      year: 2025,
      month: 11,
    });
  });

  it("abre un rango real del mes elegido y rechaza rangos inválidos", () => {
    expect(selectCustom(november)).toEqual({
      mode: "custom",
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(periodQueryError({
      mode: "custom",
      from: "2026-03-10",
      to: "2026-03-01",
    })).toBe("La fecha inicial no puede ser posterior a la final.");
    expect(periodQueryError({
      mode: "custom",
      from: "2026-02-31",
      to: "2026-03-01",
    })).toBe("Elegí fechas válidas.");
    expect(periodQueryError({
      mode: "custom",
      from: "2026-03-01",
      to: "2026-03-31",
    })).toBeNull();
  });

  it("propone el período anterior real", () => {
    expect(previousPeriod(november)).toEqual({ mode: "month", year: 2026, month: 10 });
    expect(previousPeriod({ mode: "month", year: 2026, month: 1 })).toEqual({
      mode: "month",
      year: 2025,
      month: 12,
    });
    expect(previousPeriod({ mode: "year", year: 2026 })).toEqual({
      mode: "year",
      year: 2025,
    });
  });

  it("arma la consulta con el contrato real y sin ambiente", () => {
    const month = statisticsRequestSearch({
      period: november,
      comparison: { mode: "month", year: 2025, month: 10 },
    });
    expect(month).toContain("period=month");
    expect(month).toContain("year=2026");
    expect(month).toContain("month=11");
    expect(month).toContain("comparePeriod=month");
    expect(month).toContain("compareYear=2025");
    expect(month).toContain("compareMonth=10");
    expect(month).not.toMatch(/environment/i);

    const year = statisticsRequestSearch({
      period: { mode: "year", year: 2026 },
      comparison: null,
    });
    expect(year).toBe("period=year&year=2026");

    const custom = statisticsRequestSearch({
      period: { mode: "custom", from: "2026-03-01", to: "2026-03-31" },
      comparison: { mode: "year", year: 2025 },
      clientKey: "client:abc",
    });
    expect(custom).toContain("period=custom");
    expect(custom).toContain("from=2026-03-01");
    expect(custom).toContain("to=2026-03-31");
    expect(custom).not.toContain("year=2026");
    expect(custom).toContain("comparePeriod=year");
    expect(custom).toContain("clientKey=client%3Aabc");
    expect(statisticsScopeKey(custom)).toBe(statisticsScopeKey(custom.replace("clientKey=client%3Aabc", "")));
    expect(statisticsScopeKey(month)).not.toBe(statisticsScopeKey(year));
  });
});

describe("presentación monetaria", () => {
  it("conserva los centavos del importe recibido", () => {
    expect(formatStatisticsAmount("165.40")).toBe(formatArsExact(165.4));
    expect(formatStatisticsAmount("165.40")).not.toBe(formatArs(165.4));
    expect(formatStatisticsAmount("165.40")).toContain("40");
    expect(formatStatisticsAmount("-50.00")).toBe(formatArsExact(-50));
    expect(formatStatisticsAmount("-50.00")).not.toBe(formatStatisticsAmount("50.00"));
  });

  it("no muestra un porcentaje cuando la base no es positiva", () => {
    expect(statisticsGrowthLabel("150.00", "100.00")).toBe("+50,00 %");
    expect(statisticsGrowthLabel("1.00", "3.00")).toBe("-66,67 %");
    expect(statisticsGrowthLabel("10.00", "0.00")).toBeNull();
    expect(statisticsGrowthLabel("10.00", "-5.00")).toBeNull();
    expect(statisticsGrowthLabel("-5.00", "10.00")).toBe("-150,00 %");
  });

  it("arma la torta solo con el listado completo y sin importes negativos", () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({
      key: `client:${index}`,
      label: `Cliente ${index}`,
      total: index < 6 ? "10.00" : "1.50",
    }));

    const chart = buildParticipationChart({
      rows,
      totalGroups: rows.length,
      othersLabel: "Otros clientes",
    });

    expect(chart.status).toBe("ready");
    if (chart.status !== "ready") {
      return;
    }
    expect(chart.slices).toHaveLength(7);
    expect(chart.slices.at(-1)).toEqual({
      key: "others",
      label: "Otros clientes",
      total: centsToAmountString(BigInt(300)),
    });

    expect(buildParticipationChart({
      rows: rows.slice(0, 2),
      totalGroups: 4,
      othersLabel: "Otros clientes",
    })).toMatchObject({ status: "unavailable" });

    expect(buildParticipationChart({
      rows: [
        { key: "a", label: "A", total: "10.00" },
        { key: "b", label: "B", total: "-1.00" },
      ],
      totalGroups: 2,
      othersLabel: "Otros clientes",
    })).toMatchObject({ status: "unavailable" });

    expect(buildParticipationChart({
      rows: [{ key: "a", label: "A", total: "0.00" }],
      totalGroups: 1,
      othersLabel: "Otros clientes",
    })).toEqual({ status: "hidden" });
  });
});

describe("estilos responsive de estadísticas", () => {
  it("apila tarjetas, meses y gráficos en pantallas chicas", () => {
    const scss = readFileSync("src/features/billing/styles/Statistics.module.scss", "utf8");
    expect(scss).toContain("@media (max-width: 960px)");
    expect(scss).toContain("@media (max-width: 800px)");
    expect(scss).toContain("@media (max-width: 720px)");
    expect(scss).toContain("grid-template-columns: 1fr");
    expect(scss).toContain("prefers-reduced-motion");
  });
});
