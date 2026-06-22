import { describe, expect, it } from "vitest";
import {
  buildExistingCodeIndex,
  findMatchingProductId,
  normalizeCodeForMatch,
} from "@/server/importers/match-detector";

describe("match-detector", () => {
  it("normaliza códigos para comparación", () => {
    expect(normalizeCodeForMatch(" 1-A ")).toBe("1A");
    expect(normalizeCodeForMatch("1_a")).toBe("1A");
  });

  it("detecta coincidencias por código principal", () => {
    const index = buildExistingCodeIndex([
      { id: "p1", primaryCode: "6205", normalizedCode: "6205" },
      { id: "p2", primaryCode: "1-A", normalizedCode: null },
    ]);

    expect(findMatchingProductId("6205", index)).toBe("p1");
    expect(findMatchingProductId("1 A", index)).toBe("p2");
    expect(findMatchingProductId("9999", index)).toBeUndefined();
  });
});
