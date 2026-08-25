import { describe, expect, it } from "vitest";
import {
  buildSearchPreviewCells,
  getSearchPreviewColumns,
} from "@/features/catalog/utils/search-preview-columns";

function column(overrides: {
  internalKey: string;
  displayName: string;
  originalName?: string;
  order: number;
  isPrimaryCode?: boolean;
  isDescription?: boolean;
  isImageCode?: boolean;
}) {
  return {
    originalName: overrides.originalName ?? overrides.displayName,
    isPrimaryCode: false,
    isDescription: false,
    isImageCode: false,
    ...overrides,
  };
}

describe("getSearchPreviewColumns", () => {
  it("omite código imagen y códigos generados y limita a 5 columnas", () => {
    const columns = getSearchPreviewColumns([
      column({
        internalKey: "codigo_generado",
        displayName: "Código",
        order: 0,
      }),
      column({
        internalKey: "numero",
        displayName: "NÚMERO",
        order: 1,
        isPrimaryCode: true,
      }),
      column({
        internalKey: "cod_img",
        displayName: "COD. IMG.",
        originalName: "COD. IMG.",
        order: 2,
        isImageCode: true,
      }),
      column({ internalKey: "rubro", displayName: "RUBRO", order: 3 }),
      column({ internalKey: "marca", displayName: "MARCA", order: 4 }),
      column({ internalKey: "med", displayName: "MEDIDA", order: 5 }),
      column({ internalKey: "obs", displayName: "OBS", order: 6 }),
      column({ internalKey: "extra", displayName: "EXTRA", order: 7 }),
    ]);

    expect(columns.map((item) => item.internalKey)).toEqual([
      "numero",
      "rubro",
      "marca",
      "med",
      "obs",
    ]);
  });
});

describe("buildSearchPreviewCells", () => {
  it("usa nombres y valores reales de las columnas del catálogo", () => {
    const cells = buildSearchPreviewCells(
      {
        primaryCode: "30210",
        description: "Rodamiento cónico",
        dynamicData: { rubro: "NORMAL", marca: "GRG" },
      },
      [
        column({
          internalKey: "numero",
          displayName: "NÚMERO",
          order: 0,
          isPrimaryCode: true,
        }),
        column({
          internalKey: "detalle",
          displayName: "DESCRIPCIÓN",
          order: 1,
          isDescription: true,
        }),
        column({ internalKey: "rubro", displayName: "RUBRO", order: 2 }),
        column({ internalKey: "marca", displayName: "MARCA", order: 3 }),
      ],
    );

    expect(cells).toEqual([
      { displayName: "NÚMERO", value: "30210" },
      { displayName: "DESCRIPCIÓN", value: "Rodamiento cónico" },
      { displayName: "RUBRO", value: "NORMAL" },
      { displayName: "MARCA", value: "GRG" },
    ]);
  });
});
