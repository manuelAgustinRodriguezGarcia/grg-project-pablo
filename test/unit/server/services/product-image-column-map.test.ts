import { describe, expect, it } from "vitest";
import { resolveImageColumnInternalKey } from "@/server/services/product-image-column-map";

const columns = [
  {
    internalKey: "detalle",
    originalName: "DETALLE",
    displayName: "DETALLE",
  },
  {
    internalKey: "foto_1",
    originalName: "FOTO 1",
    displayName: "FOTO 1",
  },
];

describe("resolveImageColumnInternalKey", () => {
  it("resuelve por sourceColumn con nombre de encabezado", () => {
    expect(
      resolveImageColumnInternalKey(
        { label: null, sourceColumn: "FOTO 1" },
        columns,
      ),
    ).toBe("foto_1");
  });

  it("resuelve por label cuando contiene internalKey", () => {
    expect(
      resolveImageColumnInternalKey(
        { label: "foto_1", sourceColumn: "FOTO 1" },
        columns,
      ),
    ).toBe("foto_1");
  });

  it("devuelve null si no hay columna coincidente", () => {
    expect(
      resolveImageColumnInternalKey(
        { label: null, sourceColumn: "OTRA" },
        columns,
      ),
    ).toBeNull();
  });
});
