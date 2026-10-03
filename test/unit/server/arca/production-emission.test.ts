import { describe, expect, it } from "vitest";
import { isProductionEmissionEnabledValue } from "@/shared/fiscal/production-emission";

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
