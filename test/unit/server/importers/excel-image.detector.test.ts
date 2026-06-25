import { describe, expect, it } from "vitest";
import {
  buildEmbeddedImageSummary,
  buildSheetImageStats,
  compareEmbeddedImageAnchors,
  listEmbeddedImageAnchors,
  sortEmbeddedImageAnchors,
  type EmbeddedImageAnchor,
} from "@/server/importers/excel-image.detector";

function createAnchor(
  overrides: Partial<EmbeddedImageAnchor> & Pick<EmbeddedImageAnchor, "sourceIndex">,
): EmbeddedImageAnchor {
  return {
    imageId: overrides.imageId ?? 1,
    sheetName: "Hoja1",
    row: overrides.row ?? 2,
    col: overrides.col ?? 0,
    nativeRow: overrides.nativeRow ?? 1,
    nativeCol: overrides.nativeCol ?? 0,
    nativeRowOff: overrides.nativeRowOff ?? 0,
    nativeColOff: overrides.nativeColOff ?? 0,
    columnHeader: overrides.columnHeader ?? null,
    sourceIndex: overrides.sourceIndex,
    placementKey:
      overrides.placementKey ??
      `1:${overrides.row ?? 2}:${overrides.col ?? 0}:${overrides.sourceIndex}`,
  };
}

describe("excel-image.detector", () => {
  it("lista todas las imágenes embebidas sin colapsar por fila", () => {
    const worksheet = {
      name: "Hoja1",
      getImages: () => [
        { imageId: 1, range: { tl: { nativeRow: 1, nativeCol: 0 } } },
        { imageId: 2, range: { tl: { nativeRow: 1, nativeCol: 2 } } },
        { imageId: 3, range: { tl: { nativeRow: 1, nativeCol: 4 } } },
        { imageId: 4, range: { tl: { nativeRow: 2, nativeCol: 0 } } },
      ],
    };

    const anchors = listEmbeddedImageAnchors(worksheet as never);
    const stats = buildSheetImageStats(anchors);
    const summary = buildEmbeddedImageSummary(anchors);

    expect(anchors).toHaveLength(4);
    expect(stats.totalCount).toBe(4);
    expect(stats.byRow[2]).toBe(3);
    expect(stats.byRow[3]).toBe(1);
    expect(summary.embeddedImagesDetected).toBe(4);
    expect(summary.rowsWithEmbeddedImages).toBe(2);
    expect(summary.productsWithMultipleEmbeddedImages).toBe(1);
  });

  it("ordena imágenes por fila, columna y orden de origen", () => {
    const anchors = sortEmbeddedImageAnchors([
      createAnchor({ row: 3, col: 1, sourceIndex: 0 }),
      createAnchor({ row: 2, col: 0, sourceIndex: 1 }),
      createAnchor({ row: 2, col: 0, sourceIndex: 0 }),
    ]);

    expect(anchors.map((anchor) => anchor.sourceIndex)).toEqual([0, 1, 0]);
    expect(anchors[0]?.row).toBe(2);
    expect(anchors[2]?.row).toBe(3);
    expect(compareEmbeddedImageAnchors(anchors[0]!, anchors[1]!)).toBeLessThan(0);
  });

  it("ignora entradas sin imageId válido", () => {
    const worksheet = {
      name: "Hoja1",
      getImages: () => [
        { imageId: "invalid", range: { tl: { nativeRow: 1, nativeCol: 0 } } },
        { imageId: 5, range: { tl: { nativeRow: 1, nativeCol: 1 } } },
      ],
    };

    const anchors = listEmbeddedImageAnchors(worksheet as never);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.imageId).toBe(5);
  });
});
