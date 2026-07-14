import { describe, expect, it } from "vitest";
import {
  isCodeLikeQuery,
  normalizeIndexedText,
  normalizeSearchTerm,
  normalizeTextContains,
  splitSearchTokens,
} from "@/server/search/search-normalizer";

describe("search-normalizer", () => {
  it("normaliza códigos ignorando formato y separadores", () => {
    expect(normalizeSearchTerm("1-A")).toBe("1A");
    expect(normalizeSearchTerm("1_a")).toBe("1A");
    expect(normalizeSearchTerm(" 1 A ")).toBe("1A");
    expect(normalizeSearchTerm("0193-SILVA")).toBe("0193SILVA");
    expect(normalizeSearchTerm("2902")).toBe("2902");
    expect(normalizeSearchTerm("1408")).toBe("1408");
    expect(normalizeSearchTerm("A=678")).toBe("A678");
    expect(normalizeSearchTerm("A*678")).toBe("A678");
    expect(normalizeSearchTerm("A.678")).toBe("A678");
    expect(normalizeSearchTerm("A,678")).toBe("A678");
    expect(normalizeSearchTerm("A/678")).toBe("A678");
    expect(normalizeSearchTerm("(A678)")).toBe("A678");
  });

  it("normaliza texto para búsqueda contains", () => {
    expect(normalizeTextContains("  John   D  ")).toBe("John D");
  });

  it("normaliza texto indexado ignorando separadores", () => {
    expect(normalizeIndexedText("525 P.FICH")).toBe("525PFICH");
    expect(normalizeIndexedText("525 P FICH")).toBe("525PFICH");
    expect(normalizeIndexedText("525-PFICH")).toBe("525PFICH");
    expect(normalizeIndexedText(null)).toBeNull();
  });

  it("parte términos por separadores ignorables", () => {
    expect(splitSearchTokens("bomba agua")).toEqual(["bomba", "agua"]);
    expect(splitSearchTokens("bomba-agua")).toEqual(["bomba", "agua"]);
    expect(splitSearchTokens("A=678")).toEqual(["A", "678"]);
    expect(splitSearchTokens("  (INDIEL)  ")).toEqual(["INDIEL"]);
  });

  it("detecta consultas tipo código", () => {
    expect(isCodeLikeQuery("2902")).toBe(true);
    expect(isCodeLikeQuery("1-A")).toBe(true);
    expect(isCodeLikeQuery("John Deere")).toBe(false);
  });
});
