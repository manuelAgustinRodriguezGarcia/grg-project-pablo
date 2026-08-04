import { describe, expect, it } from "vitest";
import {
  buildBetweenFilterValue,
  isPureNumericFilterValue,
  parseBetweenFilterValue,
  splitBetweenFilterValue,
} from "@/server/filters/column-filter-range";

describe("column-filter-range", () => {
  it("acepta números puros con coma o punto", () => {
    expect(isPureNumericFilterValue("105")).toBe(true);
    expect(isPureNumericFilterValue("106,36")).toBe(true);
    expect(isPureNumericFilterValue("106.4")).toBe(true);
    expect(isPureNumericFilterValue("abc")).toBe(false);
    expect(isPureNumericFilterValue("10a")).toBe(false);
    expect(isPureNumericFilterValue("")).toBe(false);
  });

  it("normaliza e invierte el rango", () => {
    expect(buildBetweenFilterValue("107", "105")).toBe("105|107");
    expect(parseBetweenFilterValue("107|105")).toEqual({ min: 105, max: 107 });
    expect(splitBetweenFilterValue("105|107")).toEqual({
      from: "105",
      to: "107",
    });
  });

  it("rechaza valores de rango inválidos", () => {
    expect(parseBetweenFilterValue("105")).toBeNull();
    expect(parseBetweenFilterValue("a|b")).toBeNull();
    expect(buildBetweenFilterValue("105", "x")).toBeNull();
  });
});
