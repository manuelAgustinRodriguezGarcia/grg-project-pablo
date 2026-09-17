import { describe, expect, it } from "vitest";
import {
  formatIvaPercent,
  isValidGenericClientLimit,
  isValidIvaPercent,
  parseIvaPercentInput,
} from "@/features/billing/utils/fiscal-settings";

describe("parseIvaPercentInput", () => {
  it("acepta coma o punto y redondea a 2 decimales", () => {
    expect(parseIvaPercentInput("21")).toBe(21);
    expect(parseIvaPercentInput("10,5")).toBe(10.5);
    expect(parseIvaPercentInput("10.55")).toBe(10.55);
    expect(parseIvaPercentInput("  ")).toBeNull();
    expect(parseIvaPercentInput("abc")).toBeNull();
  });
});

describe("formatIvaPercent", () => {
  it("usa formato es-AR", () => {
    expect(formatIvaPercent(21)).toBe("21");
    expect(formatIvaPercent(10.5)).toBe("10,5");
  });
});

describe("validaciones", () => {
  it("acota IVA y límite genérico", () => {
    expect(isValidIvaPercent(0)).toBe(true);
    expect(isValidIvaPercent(100)).toBe(true);
    expect(isValidIvaPercent(-1)).toBe(false);
    expect(isValidIvaPercent(101)).toBe(false);
    expect(isValidGenericClientLimit(400_000)).toBe(true);
    expect(isValidGenericClientLimit(0)).toBe(false);
  });
});
