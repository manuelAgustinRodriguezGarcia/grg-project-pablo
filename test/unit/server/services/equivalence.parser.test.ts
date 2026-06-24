import { describe, expect, it } from "vitest";
import { parseEquivalenceText } from "@/server/services/equivalence.parser";

describe("parseEquivalenceText", () => {
  it("parsea códigos separados por signo igual", () => {
    const tokens = parseEquivalenceText("2902=1408=0193-SILVA");

    expect(tokens.map((token) => token.normalizedCode)).toEqual([
      "2902",
      "1408",
      "0193SILVA",
    ]);
  });

  it("deduplica códigos normalizados equivalentes", () => {
    const tokens = parseEquivalenceText("1-A 1A");

    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.normalizedCode).toBe("1A");
  });

  it("soporta separadores por coma y barra", () => {
    const tokens = parseEquivalenceText("6205-2RS1, 6205LLU / 6308ZZ");

    expect(tokens.map((token) => token.normalizedCode)).toEqual([
      "62052RS1",
      "6205LLU",
      "6308ZZ",
    ]);
  });
});
