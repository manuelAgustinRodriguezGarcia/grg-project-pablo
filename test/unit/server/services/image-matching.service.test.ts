import { describe, expect, it } from "vitest";
import {
  buildProductMatchIndex,
  matchExternalImage,
  normalizeFilenameForMatch,
} from "@/server/services/image-matching.service";

describe("image-matching.service", () => {
  it("normaliza nombres de archivo para matching", () => {
    expect(normalizeFilenameForMatch("PLACA-55120IAR.jpg")).toBe("PLACA55120IAR");
  });

  it("asocia automáticamente por código en nombre de archivo", () => {
    const index = buildProductMatchIndex(
      [
        {
          id: "prod-1",
          primaryCode: "PLACA-55120IAR",
          normalizedCode: "PLACA55120IAR",
          dynamicData: {},
        },
      ],
      [],
    );

    const seenNames = new Map<string, number>();
    const outcome = matchExternalImage(
      { originalName: "PLACA-55120IAR.jpg" },
      index,
      seenNames,
    );

    expect(outcome).toEqual({ status: "ASSOCIATED_AUTO", productId: "prod-1" });
  });

  it("marca asociación ambigua cuando hay múltiples candidatos", () => {
    const index = buildProductMatchIndex(
      [
        {
          id: "prod-1",
          primaryCode: "ABC",
          normalizedCode: "ABC",
          dynamicData: {},
        },
        {
          id: "prod-2",
          primaryCode: "ABC",
          normalizedCode: "ABC",
          dynamicData: {},
        },
      ],
      [],
    );

    const outcome = matchExternalImage(
      { originalName: "ABC.png" },
      index,
      new Map<string, number>(),
    );

    expect(outcome.status).toBe("AMBIGUOUS");
    if (outcome.status === "AMBIGUOUS") {
      expect(outcome.candidates).toHaveLength(2);
    }
  });

  it("detecta nombres duplicados en el lote", () => {
    const index = buildProductMatchIndex([], []);
    const seenNames = new Map<string, number>();

    const first = matchExternalImage({ originalName: "foto.jpg" }, index, seenNames);
    const second = matchExternalImage({ originalName: "foto.jpg" }, index, seenNames);

    expect(first.status).toBe("PENDING_REVIEW");
    expect(second.status).toBe("DUPLICATE_NAME");
  });

  it("usa columnas isImageCode del dynamicData", () => {
    const index = buildProductMatchIndex(
      [
        {
          id: "prod-img",
          primaryCode: null,
          normalizedCode: null,
          dynamicData: { codigo_imagen: "IMG-001" },
        },
      ],
      ["codigo_imagen"],
    );

    const outcome = matchExternalImage(
      { originalName: "IMG-001.webp" },
      index,
      new Map<string, number>(),
    );

    expect(outcome).toEqual({ status: "ASSOCIATED_AUTO", productId: "prod-img" });
  });

  it("asocia por código imagen aunque el primaryCode sea distinto", () => {
    const index = buildProductMatchIndex(
      [
        {
          id: "prod-alt",
          primaryCode: "35212514-INDIEL",
          normalizedCode: "35212514INDIEL",
          dynamicData: { codigo_imagen: "ALTERNADOR-35212514INDIEL" },
        },
      ],
      ["codigo_imagen"],
    );

    const outcome = matchExternalImage(
      { originalName: "ALTERNADOR-35212514INDIEL.jpg" },
      index,
      new Map<string, number>(),
    );

    expect(outcome).toEqual({ status: "ASSOCIATED_AUTO", productId: "prod-alt" });
  });

  it("omite primaryCode del índice cuando includePrimaryCode es false", () => {
    const index = buildProductMatchIndex(
      [
        {
          id: "prod-generated",
          primaryCode: "a3f9c2",
          normalizedCode: "A3F9C2",
          dynamicData: {},
        },
      ],
      [],
      { includePrimaryCode: false },
    );

    const outcome = matchExternalImage(
      { originalName: "a3f9c2.jpg" },
      index,
      new Map<string, number>(),
    );

    expect(outcome.status).toBe("PENDING_REVIEW");
  });
});
