import { describe, expect, it } from "vitest";
import {
  buildExistingCodeIndex,
  buildExistingContentIndex,
  buildRowContentFingerprint,
  findMatchingProductId,
  findMatchingProductIdByContent,
  normalizeCodeForMatch,
  resolveImportProductMatchId,
} from "@/server/importers/match-detector";

describe("match-detector", () => {
  it("normaliza códigos para comparación", () => {
    expect(normalizeCodeForMatch(" 1-A ")).toBe("1A");
    expect(normalizeCodeForMatch("1_a")).toBe("1A");
    expect(normalizeCodeForMatch("A=678")).toBe("A678");
    expect(normalizeCodeForMatch("(A.678)")).toBe("A678");
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

  it("detecta coincidencias por contenido de fila", () => {
    const index = buildExistingContentIndex(
      [
        {
          id: "p1",
          description: "Rodamiento",
          dynamicData: { marca: "SKF", medida: "6205" },
        },
        {
          id: "p2",
          description: null,
          dynamicData: { marca: "NSK", medida: "6206" },
        },
      ],
      { allowedKeys: ["marca", "medida"] },
    );

    expect(
      findMatchingProductIdByContent(
        {
          description: "Rodamiento",
          dynamicData: { marca: "SKF", medida: "6205", extra: "nueva" },
        },
        index,
        { allowedKeys: ["marca", "medida"] },
      ),
    ).toBe("p1");

    expect(
      findMatchingProductIdByContent(
        {
          description: null,
          dynamicData: { marca: "FAG", medida: "6207" },
        },
        index,
        { allowedKeys: ["marca", "medida"] },
      ),
    ).toBeUndefined();
  });

  it("ignora columnas nuevas al armar el fingerprint", () => {
    const left = buildRowContentFingerprint(
      {
        description: null,
        dynamicData: { marca: "SKF", medida: "6205", nueva: "X" },
      },
      { allowedKeys: ["marca", "medida"] },
    );
    const right = buildRowContentFingerprint(
      {
        description: null,
        dynamicData: { marca: "SKF", medida: "6205" },
      },
      { allowedKeys: ["marca", "medida"] },
    );

    expect(left).toBe(right);
  });

  it("prioriza contenido cuando preferContentMatch está activo", () => {
    const codeIndex = buildExistingCodeIndex([
      { id: "by-code", primaryCode: "GEN-1", normalizedCode: "GEN1" },
    ]);
    const contentIndex = buildExistingContentIndex(
      [
        {
          id: "by-content",
          description: null,
          dynamicData: { marca: "SKF", medida: "6205" },
        },
      ],
      { allowedKeys: ["marca", "medida"] },
    );

    expect(
      resolveImportProductMatchId(
        {
          primaryCode: "GEN-1",
          description: null,
          dynamicData: { marca: "SKF", medida: "6205" },
        },
        { codeIndex, contentIndex },
        { allowedKeys: ["marca", "medida"], preferContentMatch: true },
      ),
    ).toBe("by-content");

    expect(
      resolveImportProductMatchId(
        {
          primaryCode: "GEN-1",
          description: null,
          dynamicData: { marca: "SKF", medida: "6205" },
        },
        { codeIndex, contentIndex },
        { allowedKeys: ["marca", "medida"], preferContentMatch: false },
      ),
    ).toBe("by-code");
  });
});
