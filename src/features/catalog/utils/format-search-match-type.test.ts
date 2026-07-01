import { describe, expect, it } from "vitest";
import {
  formatSearchMatchType,
  truncateMatchValue,
} from "./format-search-match-type";

describe("formatSearchMatchType", () => {
  it("maps match types to Spanish labels", () => {
    expect(formatSearchMatchType("primaryCode")).toBe("Código");
    expect(formatSearchMatchType("equivalence")).toBe("Equivalencia");
    expect(formatSearchMatchType("description")).toBe("Descripción");
    expect(formatSearchMatchType("indexedText")).toBe("Texto indexado");
    expect(formatSearchMatchType("column")).toBe("Columna");
  });
});

describe("truncateMatchValue", () => {
  it("truncates long values with an ellipsis", () => {
    const value = "a".repeat(100);
    expect(truncateMatchValue(value, 20)).toBe(`${"a".repeat(19)}…`);
  });
});
