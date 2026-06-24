import { describe, expect, it } from "vitest";
import { generateImportPrimaryCode } from "@/server/importers/generated-primary-code";

describe("generateImportPrimaryCode", () => {
  it("genera códigos hex de 6 caracteres en minúsculas", () => {
    const used = new Set<string>();
    const code = generateImportPrimaryCode(used);

    expect(code).toMatch(/^[0-9a-f]{6}$/);
    expect(used.has(code)).toBe(true);
  });

  it("no repite códigos dentro del mismo lote", () => {
    const used = new Set<string>();
    const codes = Array.from({ length: 20 }, () => generateImportPrimaryCode(used));

    expect(new Set(codes).size).toBe(20);
  });
});
