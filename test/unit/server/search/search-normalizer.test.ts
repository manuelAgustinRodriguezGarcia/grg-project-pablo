import { describe, expect, it } from "vitest";
import {
  isCodeLikeQuery,
  normalizeSearchTerm,
  normalizeTextContains,
} from "@/server/search/search-normalizer";

describe("search-normalizer", () => {
  it("normaliza códigos ignorando formato", () => {
    expect(normalizeSearchTerm("1-A")).toBe("1A");
    expect(normalizeSearchTerm("1_a")).toBe("1A");
    expect(normalizeSearchTerm(" 1 A ")).toBe("1A");
    expect(normalizeSearchTerm("0193-SILVA")).toBe("0193SILVA");
    expect(normalizeSearchTerm("2902")).toBe("2902");
    expect(normalizeSearchTerm("1408")).toBe("1408");
  });

  it("normaliza texto para búsqueda contains", () => {
    expect(normalizeTextContains("  John   D  ")).toBe("John D");
  });

  it("detecta consultas tipo código", () => {
    expect(isCodeLikeQuery("2902")).toBe(true);
    expect(isCodeLikeQuery("1-A")).toBe(true);
    expect(isCodeLikeQuery("John Deere")).toBe(false);
  });
});
