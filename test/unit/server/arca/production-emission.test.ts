import { describe, expect, it } from "vitest";
import {
  isNoteProductionEmissionEnabledValue,
  isProductionEmissionEnabledValue,
} from "@/shared/fiscal/production-emission";

describe("isProductionEmissionEnabledValue", () => {
  it("solo acepta el texto exacto true", () => {
    expect(isProductionEmissionEnabledValue("true")).toBe(true);
    expect(isProductionEmissionEnabledValue(undefined)).toBe(false);
    expect(isProductionEmissionEnabledValue("")).toBe(false);
    expect(isProductionEmissionEnabledValue("false")).toBe(false);
    expect(isProductionEmissionEnabledValue("TRUE")).toBe(false);
    expect(isProductionEmissionEnabledValue("True")).toBe(false);
    expect(isProductionEmissionEnabledValue(" true ")).toBe(false);
  });
});

describe("isNoteProductionEmissionEnabledValue", () => {
  it("solo acepta el texto exacto true y queda apagado si falta", () => {
    expect(isNoteProductionEmissionEnabledValue("true")).toBe(true);
    expect(isNoteProductionEmissionEnabledValue(undefined)).toBe(false);
    expect(isNoteProductionEmissionEnabledValue("")).toBe(false);
    expect(isNoteProductionEmissionEnabledValue("false")).toBe(false);
    expect(isNoteProductionEmissionEnabledValue("TRUE")).toBe(false);
    expect(isNoteProductionEmissionEnabledValue("True")).toBe(false);
    expect(isNoteProductionEmissionEnabledValue(" true ")).toBe(false);
  });
});
