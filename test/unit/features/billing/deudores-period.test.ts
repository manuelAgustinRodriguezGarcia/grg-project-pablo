import { describe, expect, it } from "vitest";
import {
  annualRangeIso,
  isDeudoresCustomRangeValid,
  monthRangeIso,
  resolveDeudoresPeriod,
} from "@/features/billing/utils/deudores-period";

describe("deudores-period", () => {
  it("arma rangos mensuales y anuales inclusive", () => {
    expect(monthRangeIso(2026, 2)).toEqual({
      fromDate: "2026-02-01",
      toDate: "2026-02-28",
    });
    expect(annualRangeIso(2025)).toEqual({
      fromDate: "2025-01-01",
      toDate: "2025-12-31",
    });
  });

  it("valida personalizado desde <= hasta", () => {
    expect(isDeudoresCustomRangeValid("2026-01-10", "2026-01-09")).toBe(false);
    expect(isDeudoresCustomRangeValid("2026-01-10", "2026-01-10")).toBe(true);
  });

  it("resuelve mensual, anual y personalizado", () => {
    expect(
      resolveDeudoresPeriod({
        kind: "monthly",
        monthValue: "2026-08",
        fromValue: "",
        toValue: "",
        year: 2026,
      }),
    ).toMatchObject({
      kind: "monthly",
      fromDate: "2026-08-01",
      toDate: "2026-08-31",
    });

    expect(
      resolveDeudoresPeriod({
        kind: "annual",
        monthValue: "",
        fromValue: "",
        toValue: "",
        year: 2024,
      }),
    ).toEqual({
      kind: "annual",
      fromDate: "2024-01-01",
      toDate: "2024-12-31",
      label: "2024",
    });

    expect(
      resolveDeudoresPeriod({
        kind: "custom",
        monthValue: "",
        fromValue: "2026-03-01",
        toValue: "2026-02-01",
        year: 2026,
      }),
    ).toEqual({
      error: "La fecha desde no puede ser posterior a la fecha hasta.",
    });
  });
});
