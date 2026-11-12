import { describe, expect, it } from "vitest";
import { BILLING_STATISTICS_PATH } from "@/features/billing/utils/billing-statistics-period";
import {
  billingStatisticsHref,
  parseStatisticsNavigation,
} from "@/features/billing/utils/billing-statistics-navigation";

describe("navegación de estadísticas", () => {
  it("arma el enlace del análisis elegido", () => {
    expect(billingStatisticsHref("clientes", "ranking")).toBe(
      `${BILLING_STATISTICS_PATH}?seccion=clientes&analisis=ranking`,
    );
    expect(billingStatisticsHref("rubros", "participacion")).toBe(
      `${BILLING_STATISTICS_PATH}?seccion=rubros&analisis=participacion`,
    );
    expect(billingStatisticsHref("clientes", "evolucion")).toBe(
      `${BILLING_STATISTICS_PATH}?seccion=clientes&analisis=evolucion`,
    );
  });

  it("acepta sección y análisis válidos y conserva la vista si faltan", () => {
    expect(parseStatisticsNavigation("rubros", "evolucion")).toEqual({
      section: "rubros",
      analysis: "evolucion",
    });
    expect(parseStatisticsNavigation("clientes", "participacion")).toEqual({
      section: "clients",
      analysis: "participacion",
    });
    expect(parseStatisticsNavigation(" rubros ", undefined)).toEqual({
      section: "rubros",
      analysis: null,
    });
    expect(parseStatisticsNavigation(undefined, undefined)).toEqual({
      section: "clients",
      analysis: null,
    });
  });

  it("abre la vista predeterminada cuando un parámetro es inválido", () => {
    expect(parseStatisticsNavigation("clientes", "torta")).toEqual({
      section: "clients",
      analysis: null,
    });
    expect(parseStatisticsNavigation("proveedores", "ranking")).toEqual({
      section: "clients",
      analysis: null,
    });
    expect(parseStatisticsNavigation("RUBROS", "evolucion")).toEqual({
      section: "clients",
      analysis: null,
    });
    expect(parseStatisticsNavigation("", " ")).toEqual({
      section: "clients",
      analysis: null,
    });
  });
});
