import { describe, expect, it } from "vitest";
import { BILLING_STATISTICS_PATH } from "@/features/billing/utils/billing-statistics-period";
import {
  billingStatisticsHref,
  billingStatisticsSectionHref,
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
    expect(billingStatisticsSectionHref("clientes")).toBe(
      `${BILLING_STATISTICS_PATH}?seccion=clientes`,
    );
    expect(billingStatisticsSectionHref("rubros")).toBe(
      `${BILLING_STATISTICS_PATH}?seccion=rubros`,
    );
  });

  it("acepta sección y análisis válidos y conserva la vista si faltan", () => {
    expect(parseStatisticsNavigation("rubros", "evolucion")).toEqual({
      section: "rubros",
      analysis: "evolucion",
      scrollToSection: false,
    });
    expect(parseStatisticsNavigation("clientes", "participacion")).toEqual({
      section: "clients",
      analysis: "participacion",
      scrollToSection: false,
    });
    expect(parseStatisticsNavigation(" rubros ", undefined)).toEqual({
      section: "rubros",
      analysis: null,
      scrollToSection: true,
    });
    expect(parseStatisticsNavigation(undefined, undefined)).toEqual({
      section: "clients",
      analysis: null,
      scrollToSection: false,
    });
  });

  it("abre la vista predeterminada cuando un parámetro es inválido", () => {
    expect(parseStatisticsNavigation("clientes", "torta")).toEqual({
      section: "clients",
      analysis: null,
      scrollToSection: false,
    });
    expect(parseStatisticsNavigation("proveedores", "ranking")).toEqual({
      section: "clients",
      analysis: null,
      scrollToSection: false,
    });
    expect(parseStatisticsNavigation("RUBROS", "evolucion")).toEqual({
      section: "clients",
      analysis: null,
      scrollToSection: false,
    });
    expect(parseStatisticsNavigation("", " ")).toEqual({
      section: "clients",
      analysis: null,
      scrollToSection: false,
    });
  });
});
